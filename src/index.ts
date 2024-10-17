import { z } from 'zod';
import { deepGet, OptionalProps, toMap } from './utils';
import {
  MiddlewareFunction,
  ProcedureParams,
  ProcedureType,
} from '@trpc/server';
import { PostHog } from 'posthog-node';

export type PosthogMiddlewareConfig<TParams extends ProcedureParams> = {
  /**
   * PostHog client
   */
  client: Pick<PostHog, 'capture'> | undefined;

  /**
   * Function that gets the distinct id from the context. If it returns undefined,
   * no event is sent.
   * @param ctx
   */
  getDistinctId: (ctx: TParams['_ctx_out']) => string | undefined;

  /**
   * Get other props you want to add to the event from the provided context.
   * @param ctx
   */
  getPropsFromContext?: (
    ctx: TParams['_ctx_out']
  ) => Record<string, string | boolean | Date | undefined | null>;

  /**
   * Also send events for queries. Defaults to false.
   */
  includeQueries?: boolean;

  /**
   * Use a custom event name. Defaults to <"mutate"|"query">:<path>, eg:
   * mutate:helloWorld.
   * @param fn function that returns event name from type & path.
   */
  getEventName?: (fn: { type: ProcedureType; path: string }) => string;
};

const PosthogMutationsMeta = z
  .object({
    ph__skip: z.literal(true).optional(),
    ph__captureInput: z
      .array(
        z.object({
          ph__path: z.string(),
          ph__name: z.string(),
          ph__type: z.enum(['isSet']).optional(),
        })
      )
      .default([]),
  })
  .default({});

/**
 * Extra configuration options per procedure that can be added in the .meta()
 * function.
 */
export const ph = {
  /**
   * Add input values as property to events
   * @param inputs list of properties to add.
   */
  capture: (
    inputs: z.infer<typeof PosthogMutationsMeta>['ph__captureInput']
  ) => ({
    ph__captureInput: inputs,
  }),

  /**
   * Do not send an event for this endpoint.
   */
  skip: () => ({ ph__skip: true }),

  /**
   * Add value of input parameter to event.
   * @param path dot separated path for input parameter
   * @param name name of property (defaults to path)
   */
  string: (path: string, name?: string) => ({
    ph__path: path,
    ph__name: name ?? path,
  }),

  /**
   * Return true/false if the input property is provided.
   * @param path dot separated path for input parameter
   * @param name name of property (defaults to path)
   */
  isSet: (path: string, name?: string) => ({
    ph__path: path,
    ph__name: name ?? path,
    ph__type: 'isSet' as const,
  }),
};

/**
 * Returns a middleware that should be added to (one of) your root procedures.
 * The default configuration logs an event to PostHog for every mutation called.
 * @param config
 */
export const posthogMiddleware = <TParams extends ProcedureParams>(
  config: PosthogMiddlewareConfig<TParams>
): MiddlewareFunction<TParams, TParams> => {
  const defaultConfig: OptionalProps<PosthogMiddlewareConfig<TParams>> = {
    includeQueries: false,
    getEventName: (params) =>
      `${params.type === 'mutation' ? 'mutate' : params.type}:${params.path}`,
  };

  if (!config.client) {
    // Disable when client is undefined, makes it easier to condionally use this
    // middleware based on whether or not you have PostHog configured.
    return ({ next }) => next();
  }

  const mergedConfig = { ...defaultConfig, ...config };

  return async ({ next, ctx, type, rawInput, meta, path }) => {
    const result = await next();
    const distinctId = mergedConfig.getDistinctId(ctx);

    if (!distinctId) {
      // Skip unauthenticated requests
      return result;
    }

    if (type !== 'mutation' && !mergedConfig.includeQueries) {
      // Skip queries unless configured
      return result;
    }

    if (!result.ok) {
      // Skip errors (for now)
      return result;
    }

    const parsedMeta = meta ? PosthogMutationsMeta.parse(meta) : null;
    if (parsedMeta?.ph__skip) {
      return result;
    }

    const inputProps =
      parsedMeta?.ph__captureInput
        ?.map((prop) => ({
          key: prop.ph__name,
          value:
            prop.ph__type === 'isSet'
              ? deepGet(rawInput, prop.ph__path) !== undefined
              : deepGet(rawInput, prop.ph__path),
        }))
        .filter((it) => it.value !== undefined) ?? [];

    const ctxProps = mergedConfig.getPropsFromContext
      ? mergedConfig.getPropsFromContext(ctx)
      : {};

    const capture = {
      distinctId: distinctId,
      // Prefer active verbs (mutate instead of mutation)
      event: `${type === 'mutation' ? 'mutate' : type}:${path}`,
      properties: {
        ...toMap(inputProps),
        ...ctxProps,
      },
    };
    mergedConfig.client?.capture(capture);

    return result;
  };
};
