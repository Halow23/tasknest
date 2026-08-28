import { describe, expect, it } from "vitest";
import { getTaskNestEmailAccessDecision, isAllowedTaskNestEmail } from "./accessPolicy";

const rules = {
  allowedDomains: ["foundationu.com"],
  allowedEmails: ["advisor@external.org"],
};

describe("managed TaskNest email access policy", () => {
  it("allows a verified email in an administrator-managed domain", () => {
    expect(isAllowedTaskNestEmail("student@foundationu.com", rules)).toBe(true);
  });

  it("allows a specifically allowlisted external collaborator", () => {
    expect(isAllowedTaskNestEmail("advisor@external.org", rules)).toBe(true);
  });

  it("matches managed rules without regard to email case or outer whitespace", () => {
    expect(isAllowedTaskNestEmail("  Student@FoundationU.COM ", rules)).toBe(true);
  });

  it("denies personal, lookalike, and missing emails with audit-ready reasons", () => {
    expect(getTaskNestEmailAccessDecision("student@gmail.com", rules)).toMatchObject({
      allowed: false,
      emailDomain: "gmail.com",
      reason: "email_not_approved",
    });
    expect(getTaskNestEmailAccessDecision("student@foundationu.com.example", rules).allowed).toBe(false);
    expect(getTaskNestEmailAccessDecision(null, rules)).toMatchObject({ allowed: false, reason: "missing_email" });
  });
});
