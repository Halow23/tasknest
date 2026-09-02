import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { accessManagementRouter } from "./routers/accessManagement";
import { tasknestRouter } from "./routers/tasknest";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    access: publicProcedure.query((opts) => ({ denied: opts.ctx.accessDenied })),
    // Sessions are Firebase ID tokens held by the client; sign-out happens in
    // the browser via firebase.auth().signOut(). Kept for client compatibility.
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),
  accessManagement: accessManagementRouter,
  tasknest: tasknestRouter,
});

export type AppRouter = typeof appRouter;
