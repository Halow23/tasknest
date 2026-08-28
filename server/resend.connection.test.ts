import { describe, expect, it } from "vitest";

function senderDomain(from: string) {
  const email = from.match(/<([^>]+)>/)?.[1] ?? from;
  return email.trim().split("@")[1]?.toLowerCase();
}

describe("Resend invitation email configuration", () => {
  it("authenticates against the documented sent-email list endpoint", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    expect(apiKey).toMatch(/^re_/);
    expect(from).toContain("@");

    const response = await fetch("https://api.resend.com/emails?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(response.ok).toBe(true);

    const result = await response.json() as { object?: string; data?: unknown[] };
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  }, 15_000);
});
