import { AnyRootConfig, initTRPC, ProcedureParams } from '@trpc/server';
import { posthogMiddleware, PosthogMiddlewareConfig } from '../src';

export type TestContext = { username: string };

export const buildTestContext = (
  config: PosthogMiddlewareConfig<ProcedureParams<AnyRootConfig, TestContext>>
) => {
  const t = initTRPC.context<TestContext>().create();
  const router = t.router;
  const createCallerFactory = t.createCallerFactory;
  const posthogProcedure = t.procedure.use(posthogMiddleware(config));

  return {
    router,
    procedure: posthogProcedure,
    build: createCallerFactory,
  };
};
