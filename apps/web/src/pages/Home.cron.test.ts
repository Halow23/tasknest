import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("reminders, digest, and purge cron", () => {
  it("sweeps generate deduped notifications and per-member digests", async () => {
    const jobs = await readFile(new URL("../../../api/src/scheduledJobs.ts", import.meta.url), "utf8");

    expect(jobs).toContain("export async function runReminderSweep(");
    expect(jobs).toContain('const type = isOverdue ? "overdue" : "due_today";');
    expect(jobs).toContain("if (hasUnread) {");
    expect(jobs).toContain("export async function runDigestSweep(");
    expect(jobs).toContain("if (overdue.length === 0 && dueToday.length === 0) {");
    expect(jobs).toContain("export async function runPurgeSweep(");
    expect(jobs).toContain('.where("deletedAt", "==", null)');
    expect(jobs).toContain('.where("dueAt", "<=", endTs)');
  });

  it("sends the digest through Resend with a per-user-day idempotency key", async () => {
    const email = await readFile(new URL("../../../api/src/digestEmail.ts", import.meta.url), "utf8");

    expect(email).toContain("export async function sendDailyDigestEmail(");
    expect(email).toContain("tasknest-digest/${input.recipientEmail}/${dateKey}");
    expect(email).toContain('if (input.dueToday.length === 0 && input.overdue.length === 0) throw new Error("Nothing to send.");');
    expect(email).toContain("/?task=${task.id}");
  });

  it("registers authenticated /api/scheduled routes gated by the cron secret", async () => {
    const routes = await readFile(new URL("../../../api/src/_core/scheduledRoutes.ts", import.meta.url), "utf8");
    const index = await readFile(new URL("../../../api/src/_core/index.ts", import.meta.url), "utf8");

    expect(routes).toContain('app.post("/api/scheduled/reminders"');
    expect(routes).toContain('app.post("/api/scheduled/digest"');
    expect(routes).toContain('app.post("/api/scheduled/purge"');
    expect(routes).toContain('bodySecret === ENV.cronSecret');
    expect(index).toContain("registerScheduledJobs(app);");
  });
});
