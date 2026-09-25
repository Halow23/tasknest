import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { updateUserPreferences, updateUserProfile } from "../firestore/workspace";
import { storagePresignImagePutUrl } from "../storage";

/**
 * User profile & preferences. Owned entirely by the signed-in user —
 * procedures always operate on ctx.user.id, never on a passed id.
 */
export const userRouter = router({
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(1).max(80),
      photoURL: z.string().url().max(500).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return (await updateUserProfile(ctx.user.id, { name: input.name, photoURL: input.photoURL })) ?? ctx.user;
    }),

  setPreferences: protectedProcedure
    .input(z.object({
      density: z.enum(["comfortable", "compact"]).optional(),
      emailDigest: z.boolean().optional(),
    }).refine(value => value.density !== undefined || value.emailDigest !== undefined, {
      message: "Nothing to update.",
    }))
    .mutation(async ({ ctx, input }) => {
      return (await updateUserPreferences(ctx.user.id, { density: input.density, emailDigest: input.emailDigest })) ?? ctx.user;
    }),

  presignAvatar: protectedProcedure
    .input(z.object({ filename: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const ext = (input.filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      return storagePresignImagePutUrl(`avatars/${ctx.user.id}/${Date.now()}.${ext}`);
    }),
});
