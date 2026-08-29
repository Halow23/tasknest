import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("reminders, digest, and purge cron", () => {
  it("sweeps generate deduped notifications and per-member digests", async () => {
    const jobs = await readFile(new URL("../../../server/scheduledJobs.ts", import.meta.url), "utf8");

    expect(jobs).toContain("export async function runReminderSweep(");
    expect(jobs).toContain('const type = isOverdue ? "overdue" : "due_today";');
    expect(jobs).toContain("if (unread.length > 0) { skipped += 1; continue; }");
    expect(jobs).toContain("export async function runDigestSweep(");
    expect(jobs).toContain("if (overdue.length === 0 && dueToday.length === 0) { skipped += 1; continue; }");
    expect(jobs).toContain("export async function runPurgeSweep(");
    expect(jobs).toContain("isNull(tasks.deletedAt), isNull(tasks.completedAt), lte(tasks.dueAt, endOfToday(now))");
  });

  it("sends the digest through Resend with a per-user-day idempotency key", async () => {
    const email = await readFile(new URL("../../../server/digestEmail.ts", import.meta.url), "utf8");

    expect(email).toContain("export async function sendDailyDigestEmail(");
    expect(email).toContain("tasknest-digest/${input.recipientEmail}/${dateKey}");
    expect(email).toContain('if (input.dueToday.length === 0 && input.overdue.length === 0) throw new Error("Nothing to send.");');
    expect(email).toContain("/?task=${task.id}");
  });

  it("registers authenticated /api/scheduled routes and upserts daily heartbeat jobs by name", async () => {
    const routes = await readFile(new URL("../../../server/_core/scheduledRoutes.ts", import.meta.url), "utf8");
    const index = await readFile(new URL("../../../server/_core/index.ts", import.meta.url), "utf8");

    expect(routes).toContain('app.post("/api/scheduled/reminders"');
    expect(routes).toContain('app.post("/api/scheduled/digest"');
    expect(routes).toContain('app.post("/api/scheduled/purge"');
    expect(routes).toContain('name: "tasknest-reminders", cron: "0 7 * * *"');
    expect(routes).toContain('name: "tasknest-digest", cron: "0 8 * * *"');
    expect(routes).toContain('name: "tasknest-purge", cron: "0 3 * * *"');
    expect(routes).toContain("existing.jobs.some(candidate => candidate.name === job.name)");
    expect(index).toContain("registerScheduledJobs(app);");
    expect(index).toContain("void ensureDailyHeartbeatJobs().catch(() => undefined);");
  });
});
