import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getTaskNestEmailAccessDecision, isExternalEmailAccessActive } from "../accessPolicy";
import {
  addAllowedDomain,
  addAllowedExternalEmail,
  getManagedAccessRules,
  listDeniedSignInAlerts,
  listDeniedSignInEvents,
  removeAllowedDomain,
  removeAllowedExternalEmail,
  setAllowedExternalEmailExpiry,
} from "../db";
import { adminProcedure, router } from "../_core/trpc";

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(255)
  .regex(/^(?!-)(?:[a-z0-9-]+\.)+[a-z]{2,63}$/, "Enter a valid domain, such as foundationu.com.");

const emailSchema = z.string().trim().toLowerCase().email().max(320);

function currentRules(records: Awaited<ReturnType<typeof getManagedAccessRules>>) {
  return {
    allowedDomains: records.domains.map((record) => record.domain),
    allowedEmails: records.emails.filter((record) => isExternalEmailAccessActive(record.expiresAt)).map((record) => record.email),
  };
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
  removeDomain: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const existing = await getManagedAccessRules();
    const target = existing.domains.find((record) => record.id === input.id);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Approved domain not found." });

    const nextRules = {
      allowedDomains: existing.domains.filter((record) => record.id !== input.id).map((record) => record.domain),
      allowedEmails: existing.emails.map((record) => record.email),
    };
    if (nextRules.allowedDomains.length + nextRules.allowedEmails.length === 0) {
      throw new TRPCError({ code: "CONFLICT", message: "Keep at least one approved domain or individual email." });
    }
    if (!getTaskNestEmailAccessDecision(ctx.user.email, nextRules).allowed) {
      throw new TRPCError({ code: "CONFLICT", message: "Add a rule that permits your own email before removing this domain." });
    }

    await removeAllowedDomain(target.id);
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
      return addAllowedExternalEmail({ email: input.email, note: input.note, expiresAt: input.expiresAt, createdById: ctx.user.id });
    }),
  setExternalExpiry: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      expiresAt: z.date().nullable().refine((value) => !value || value.getTime() > Date.now(), "Choose a future expiration date."),
    }))
    .mutation(async ({ input }) => {
      const existing = await getManagedAccessRules();
      if (!existing.emails.some((record) => record.id === input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Allowlisted email not found." });
      }
      return setAllowedExternalEmailExpiry(input);
    }),
  removeExternalEmail: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const existing = await getManagedAccessRules();
    const target = existing.emails.find((record) => record.id === input.id);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Allowlisted email not found." });

    const nextRules = {
      allowedDomains: existing.domains.map((record) => record.domain),
      allowedEmails: existing.emails.filter((record) => record.id !== input.id).map((record) => record.email),
    };
    if (nextRules.allowedDomains.length + nextRules.allowedEmails.length === 0) {
      throw new TRPCError({ code: "CONFLICT", message: "Keep at least one approved domain or individual email." });
    }
    if (!getTaskNestEmailAccessDecision(ctx.user.email, nextRules).allowed) {
      throw new TRPCError({ code: "CONFLICT", message: "Add a rule that permits your own email before removing this allowlist entry." });
    }

    await removeAllowedExternalEmail(target.id);
    return { deletedId: target.id };
  }),
  deniedSignIns: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(50), search: z.string().trim().max(320).optional() }).optional())
    .query(({ input }) => listDeniedSignInEvents({ limit: input?.limit ?? 50, search: input?.search })),
  exportDeniedSignIns: adminProcedure
    .input(z.object({ search: z.string().trim().max(320).optional() }).optional())
    .query(({ input }) => listDeniedSignInEvents({ limit: 500, search: input?.search })),
  deniedSignInAlerts: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(({ input }) => listDeniedSignInAlerts(input?.limit ?? 20)),
});
