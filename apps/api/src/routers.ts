import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { accessManagementRouter } from "./routers/accessManagement";
import { tasknestRouter } from "./routers/tasknest";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    access: publicProcedure.query((opts) => ({ denied: opts.ctx.accessDenied })),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  accessManagement: accessManagementRouter,
  tasknest: tasknestRouter,
});

export type AppRouter = typeof appRouter;
