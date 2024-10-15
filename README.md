# posthog-trpc

This library can be used to easily connect your trpc backend to PostHog.

## TL;DR
```typescript
import { initTRPC } from '@trpc/server';
import { PostHog } from "posthog-node";
import { posthogMiddleware, ph } from 'posthog-trpc';
import { z } from 'zod'

type Context = { userId: string; username: string };
const t = initTRPC.context<Context>().create();

// Automatically sends an event for every mutation, see below for more configuration options.
export const posthogProcedure = t.procedure.use(
  posthogMiddleware({
    client: new PostHog('Your key'),
    getDistinctId: ctx => ctx.userId,
  })
);

// Define your routes using the posthogProcedure:
const appRouter = router({
  hello: posthogProcedure
    .input(
      z.object({
        name: z.string(),
        age: z.number().optional(),
      })
    )
    // Define extra event properties that are taken from the input:
    .meta(ph.capture([
      ph.string('name'), 
      ph.isSet('age')
    ]))
    .mutation(async ({ input }) => {
      return { message: `Hello ${input.name}` };
    }),
  health: posthogProcedure
    // Or skip an endpoint
    .meta(ph.skip())
    .mutation(async () => ({status: 'healthy'}))
})
```

## Configuration

### Generic configuration 

```typescript
type PosthogMiddlewareConfig<TParams extends ProcedureParams> = {
  /**
   * PostHog client
   */
  client: Pick<PostHog, 'capture'>;

  /**
   Function that gets the distinct id from the context. If it returns undefined,
   no event is sent.
   @param ctx
   */
  getDistinctId: (ctx: TParams['_ctx_out']) => string | undefined;

  /**
   * Get other props you want to add to the event from the provided context.
   * @param ctx
   */
  getPropsFromContext: (ctx: TParams['_ctx_out']) => Record<string, string>;

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
```

### Configuring specific routes
This package exports `ph`, which can be used to add metadata to routes for additional configuration:

```typescript
interface ph {
    // Define input data to capture:
    capture(opts: PostHogCaptureOption[])
    // Skip sending an event for this procedure
    skip()
  
    // PostHogCaptureOptions:
  
    // Adds {[name ?? key]: <value>} to the event properties 
    string(key: string, name?: string): PostHogCaptureOption
    // Adds {[name ?? key]: true/false} to the event properties if an optional input is provided
    isSet(key: string, name?: string): PostHogCaptureOption
}
```

