import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { publishWorkspaceEvent } from "../events";
import { assertWorkspaceMember, removeWorkspaceMember, setWorkspaceMemberRole } from "../firestore/workspace";

const memberInput = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * Workspace member management, gated to account administrators (the same
 * ADMIN_EMAILS gate as the access-management panel).
 */
export const membersRouter = router({
  setRole: adminProcedure
    .input(memberInput.extend({ role: z.enum(["admin", "user"]) }))
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot change your own workspace role." });
      }
      try {
        await setWorkspaceMemberRole(input.workspaceId, input.userId, input.role);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Could not update the role." });
      }
      publishWorkspaceEvent({ workspaceId: input.workspaceId, type: "member_role_changed", actorId: ctx.user.id, at: new Date().toISOString() });
      return { ok: true as const };
    }),

  remove: adminProcedure
    .input(memberInput)
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot remove yourself from the workspace." });
      }
      try {
        await removeWorkspaceMember(input.workspaceId, input.userId);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Could not remove the member." });
      }
      publishWorkspaceEvent({ workspaceId: input.workspaceId, type: "member_removed", actorId: ctx.user.id, at: new Date().toISOString() });
      return { ok: true as const };
    }),
});
