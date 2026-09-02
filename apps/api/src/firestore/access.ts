/**
 * Email allowlist and denied-sign-in logic backed by Firestore.
 * Replaces the MySQL-backed calls in the old db.ts.
 *
 * Pure functions from accessPolicy.ts are preserved unchanged — they operate
 * on plain string arrays and have no database dependency.
 */

import {
  allowedDomainsCol,
  allowedEmailsCol,
  deniedSignInAlertsCol,
  deniedSignInEventsCol,
  db,
  getDocs,
  toDateOrNull,
} from "./db";
import {
  getTaskNestEmailAccessDecision,
  normalizeTaskNestEmail,
  type EmailAccessDecision,
} from "../accessPolicy";
import type { AllowedDomainDoc, AllowedEmailDoc, DeniedSignInAlertDoc, DeniedSignInReason } from "./types";
import { nanoid } from "nanoid";
import { Timestamp } from "firebase-admin/firestore";

// ── Read access rules ────────────────────────────────────────────────────────

async function getAccessRules(fs = db()) {
  const [domainDocs, emailDocs] = await Promise.all([
    getDocs<AllowedDomainDoc>(allowedDomainsCol(fs)),
    getDocs<AllowedEmailDoc>(allowedEmailsCol(fs)),
  ]);
  const now = new Date();
  return {
    allowedDomains: domainDocs.map((d) => d.domain),
    allowedEmails: emailDocs
      .filter((d) => {
        const exp = toDateOrNull(d.expiresAt);
        return !exp || exp.getTime() > now.getTime();
      })
      .map((d) => d.email),
  };
}

export async function getTaskNestEmailAccess(
  email: string | null | undefined,
): Promise<EmailAccessDecision> {
  const rules = await getAccessRules();
  return getTaskNestEmailAccessDecision(email, rules);
}

// ── Manage allowlist (admin UI) ──────────────────────────────────────────────

export async function getManagedAccessRules() {
  const fs = db();
  const [domains, emails] = await Promise.all([
    getDocs<AllowedDomainDoc>(allowedDomainsCol(fs).orderBy("domain")),
    getDocs<AllowedEmailDoc>(allowedEmailsCol(fs).orderBy("email")),
  ]);
  return { domains, emails };
}

export async function addAllowedDomain(input: { domain: string; createdById: string }) {
  const fs = db();
  const domain = input.domain.trim().toLowerCase();
  const ref = allowedDomainsCol(fs).doc(domain);
  const doc: Omit<AllowedDomainDoc, "id"> = {
    domain,
    createdById: input.createdById,
    createdAt: new Date(),
  };
  await ref.set(doc);
  return { id: domain, ...doc };
}

export async function removeAllowedDomain(domain: string) {
  await allowedDomainsCol(db()).doc(domain).delete();
}

export async function addAllowedEmail(input: {
  email: string;
  note: string | null;
  expiresAt: Date | null;
  createdById: string;
}) {
  const fs = db();
  const email = normalizeTaskNestEmail(input.email) ?? input.email.trim().toLowerCase();
  const ref = allowedEmailsCol(fs).doc(email);
  const doc: Omit<AllowedEmailDoc, "id"> = {
    email,
    note: input.note,
    expiresAt: input.expiresAt,
    createdById: input.createdById,
    createdAt: new Date(),
  };
  await ref.set(doc);
  return { id: email, ...doc };
}

export async function removeAllowedEmail(email: string) {
  const normalized = normalizeTaskNestEmail(email) ?? email.trim().toLowerCase();
  await allowedEmailsCol(db()).doc(normalized).delete();
}

// ── Denied sign-in recording ─────────────────────────────────────────────────

const REPEAT_DENIAL_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function recordDeniedSignIn(input: {
  attemptedEmail: string | null;
  loginMethod: string | null;
  reason: DeniedSignInReason;
}) {
  const fs = db();
  const emailDomain = input.attemptedEmail
    ? input.attemptedEmail.split("@")[1]?.toLowerCase() ?? null
    : null;

  // Log the individual event
  const eventRef = deniedSignInEventsCol(fs).doc(nanoid());
  await eventRef.set({
    attemptedEmail: input.attemptedEmail,
    emailDomain,
    loginMethod: input.loginMethod,
    reason: input.reason,
    createdAt: new Date(),
  });

  if (!emailDomain) return;

  // Update or create the rolling alert counter
  const alertRef = deniedSignInAlertsCol(fs).doc(emailDomain);
  await fs.runTransaction(async (tx) => {
    const snap = await tx.get(alertRef);
    const now = new Date();
    if (!snap.exists) {
      const alert: Omit<DeniedSignInAlertDoc, "id"> = {
        emailDomain,
        count: 1,
        windowStartedAt: now,
        lastDeniedAt: now,
        lastNotifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(alertRef, alert);
    } else {
      const data = snap.data() as DeniedSignInAlertDoc;
      const windowStart = toDateOrNull(data.windowStartedAt) ?? now;
      const expired = now.getTime() - windowStart.getTime() > REPEAT_DENIAL_WINDOW_MS;
      if (expired) {
        tx.update(alertRef, { count: 1, windowStartedAt: Timestamp.fromDate(now), lastDeniedAt: Timestamp.fromDate(now), updatedAt: Timestamp.fromDate(now) });
      } else {
        tx.update(alertRef, { count: (data.count ?? 0) + 1, lastDeniedAt: Timestamp.fromDate(now), updatedAt: Timestamp.fromDate(now) });
      }
    }
  });
}
