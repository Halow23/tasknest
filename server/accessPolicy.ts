import type { DeniedSignInReason } from "../drizzle/schema";

export type EmailAccessRules = {
  allowedDomains: string[];
  allowedEmails: string[];
};

export type EmailAccessDecision = {
  allowed: boolean;
  normalizedEmail: string | null;
  emailDomain: string | null;
  reason: DeniedSignInReason | null;
};

export function normalizeTaskNestEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const [localPart, domain, ...remainingParts] = normalized.split("@");
  return localPart && domain && remainingParts.length === 0 ? normalized : null;
}

export function isExternalEmailAccessActive(expiresAt: Date | null, now = new Date()): boolean {
  return !expiresAt || new Date(expiresAt).getTime() > now.getTime();
}

export function getTaskNestEmailAccessDecision(
  email: string | null | undefined,
  rules: EmailAccessRules,
): EmailAccessDecision {
  const normalizedEmail = normalizeTaskNestEmail(email);
  if (!normalizedEmail) {
    return { allowed: false, normalizedEmail: null, emailDomain: null, reason: "missing_email" };
  }

  const emailDomain = normalizedEmail.slice(normalizedEmail.lastIndexOf("@") + 1);
  const allowed = rules.allowedEmails.some((entry) => normalizeTaskNestEmail(entry) === normalizedEmail)
    || rules.allowedDomains.some((entry) => entry.trim().toLowerCase() === emailDomain);

  return {
    allowed,
    normalizedEmail,
    emailDomain,
    reason: allowed ? null : "email_not_approved",
  };
}

export function isAllowedTaskNestEmail(email: string | null | undefined, rules: EmailAccessRules): boolean {
  return getTaskNestEmailAccessDecision(email, rules).allowed;
}
