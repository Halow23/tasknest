/**
 * Access to TaskNest is limited to verified Foundation University accounts.
 * Keep the domain comparison here so OAuth sign-in and existing sessions use
 * exactly the same policy.
 */
export const ALLOWED_EMAIL_DOMAIN = "foundationu.com";

export function isAllowedTaskNestEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();
  const [localPart, domain, ...remainingParts] = normalized.split("@");

  return Boolean(localPart && domain === ALLOWED_EMAIL_DOMAIN && remainingParts.length === 0);
}
