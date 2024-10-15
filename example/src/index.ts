import { initTRPC } from '@trpc/server';
import { posthogMiddleware, ph } from 'posthog-trpc';
import { posthogClient } from './posthog';
import { z } from 'zod';

export type Context = { userId: string; username: string };

const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure.use(
  posthogMiddleware({
    client: posthogClient,
    getDistinctId: (ctx) => ctx.userId,
    getPropsFromContext: (ctx) => ({
      username: ctx.username,
    }),
    includeQueries: true,
  })
);

export const router = t.router;

export const appRouter = router({
  hello: publicProcedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .output(z.object({ message: z.string() }))
    // Define which properties you want to add to the posthog event:
    .meta(ph.capture([ph.string('name')]))
    .mutation(async ({ input }) => {
      return { message: `Hello ${input.name}` };
    }),
  health: publicProcedure.meta(ph.skip()).query(() => {
    return {
      status: 'healthy',
    };
  }),
});

export type AppRouter = typeof appRouter;
