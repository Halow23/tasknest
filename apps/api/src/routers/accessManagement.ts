import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getTaskNestEmailAccessDecision, isExternalEmailAccessActive } from "../accessPolicy";
import {
  addAllowedDomain,
  addAllowedEmail,
  getManagedAccessRules,
  removeAllowedDomain,
  removeAllowedEmail,
} from "../firestore/access";
import { db, deniedSignInAlertsCol, deniedSignInEventsCol, getDocs } from "../firestore/db";
import type { DeniedSignInAlertDoc, DeniedSignInEventDoc } from "../firestore/types";
import { adminProcedure, router } from "../_core/trpc";

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(255)
  .regex(/^(?!-)(?:[a-z0-9-]+\.)+[a-z]{2,63}$/, "Enter a valid domain, such as foundationu.com.");

const emailSchema = z.string().trim().toLowerCase().email().max(320);

async function listDeniedEvents(options?: { limit?: number; search?: string }) {
  const fs = db();
  let q = deniedSignInEventsCol(fs).orderBy("createdAt", "desc").limit(options?.limit ?? 50);
  const docs = await getDocs<DeniedSignInEventDoc>(q);
  if (!options?.search) return docs;
  const s = options.search.toLowerCase();
  return docs.filter(
    (d) =>
      d.attemptedEmail?.toLowerCase().includes(s) ||
      d.emailDomain?.toLowerCase().includes(s) ||
      d.reason.includes(s),
  );
}

async function listAlerts(limit = 20) {
  const fs = db();
  return getDocs<DeniedSignInAlertDoc>(
    deniedSignInAlertsCol(fs).orderBy("lastDeniedAt", "desc").limit(limit),
  );
}

export const accessManagementRouter = router({
  settings: adminProcedure.query(async () => getManagedAccessRules()),
  addDomain: adminProcedure.input(z.object({ domain: domainSchema })).mutation(async ({ ctx, input }) => {
    const existing = await getManagedAccessRules();
    if (existing.domains.some((record) => record.domain === input.domain)) {
      throw new TRPCError({ code: "CONFLICT", message: "That domain is already approved." });
    }
    return addAllowedDomain({ domain: input.domain, createdById: ctx.user.id });
  }),
  removeDomain: adminProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const existing = await getManagedAccessRules();
    const target = existing.domains.find((record) => record.id === input.id || record.domain === input.id);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Approved domain not found." });

    const nextRules = {
      allowedDomains: existing.domains.filter((record) => record.id !== target.id).map((record) => record.domain),
      allowedEmails: existing.emails.map((record) => record.email),
    };
    if (nextRules.allowedDomains.length + nextRules.allowedEmails.length === 0) {
      throw new TRPCError({ code: "CONFLICT", message: "Keep at least one approved domain or individual email." });
    }
    if (!getTaskNestEmailAccessDecision(ctx.user.email, nextRules).allowed) {
      throw new TRPCError({ code: "CONFLICT", message: "Add a rule that permits your own email before removing this domain." });
    }

    await removeAllowedDomain(target.domain);
    return { deletedId: target.id };
  }),
  addExternalEmail: adminProcedure
    .input(z.object({
      email: emailSchema,
      note: z.string().trim().max(240).optional(),
      expiresAt: z.date().nullable().optional().refine((value) => !value || value.getTime() > Date.now(), "Choose a future expiration date."),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getManagedAccessRules();
      if (existing.emails.some((record) => record.email === input.email)) {
        throw new TRPCError({ code: "CONFLICT", message: "That email is already allowlisted." });
      }
      return addAllowedEmail({ email: input.email, note: input.note ?? null, expiresAt: input.expiresAt ?? null, createdById: ctx.user.id });
    }),
  setExternalExpiry: adminProcedure
    .input(z.object({
      id: z.string().min(1),
      expiresAt: z.date().nullable().refine((value) => !value || value.getTime() > Date.now(), "Choose a future expiration date."),
    }))
    .mutation(async ({ input }) => {
      const existing = await getManagedAccessRules();
      const target = existing.emails.find((record) => record.id === input.id || record.email === input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Allowlisted email not found." });
      await addAllowedEmail({ email: target.email, note: target.note, expiresAt: input.expiresAt, createdById: target.createdById ?? "" });
      return { id: target.id, expiresAt: input.expiresAt };
    }),
  removeExternalEmail: adminProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const existing = await getManagedAccessRules();
    const target = existing.emails.find((record) => record.id === input.id || record.email === input.id);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Allowlisted email not found." });

    const nextRules = {
      allowedDomains: existing.domains.map((record) => record.domain),
      allowedEmails: existing.emails.filter((record) => record.id !== target.id).map((record) => record.email),
    };
    if (nextRules.allowedDomains.length + nextRules.allowedEmails.length === 0) {
      throw new TRPCError({ code: "CONFLICT", message: "Keep at least one approved domain or individual email." });
    }
    if (!getTaskNestEmailAccessDecision(ctx.user.email, nextRules).allowed) {
      throw new TRPCError({ code: "CONFLICT", message: "Add a rule that permits your own email before removing this allowlist entry." });
    }

    await removeAllowedEmail(target.email);
    return { deletedId: target.id };
  }),
  deniedSignIns: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(50), search: z.string().trim().max(320).optional() }).optional())
    .query(({ input }) => listDeniedEvents({ limit: input?.limit ?? 50, search: input?.search })),
  exportDeniedSignIns: adminProcedure
    .input(z.object({ search: z.string().trim().max(320).optional() }).optional())
    .query(({ input }) => listDeniedEvents({ limit: 500, search: input?.search })),
  deniedSignInAlerts: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(({ input }) => listAlerts(input?.limit ?? 20)),
});
