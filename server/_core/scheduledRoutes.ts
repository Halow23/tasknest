import type { Express, Request, Response } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { runDigestSweep, runPurgeSweep, runReminderSweep } from "../scheduledJobs";
import { createHeartbeatJob, listHeartbeatJobs } from "./heartbeat";

/**
 * Platform-cron entry points. The Manus heartbeat service POSTs to these
 * routes on schedule; each request is authorized either as a platform cron
 * identity or via the shared JWT secret (belt and braces for local runs).
 */
async function authorize(req: Request): Promise<boolean> {
  const bodySecret = (req.body ?? {})["cronSecret"] ?? req.header("x-cron-secret");
  if (bodySecret && ENV.cookieSecret && bodySecret === ENV.cookieSecret) return true;
  try {
    const user = await sdk.authenticateRequest(req);
    return Boolean(user);
  } catch {
    return false;
  }
}

function respond(res: Response, result: unknown) {
  res.status(200).json({ ok: true, result });
}

export function registerScheduledJobs(app: Express) {
  app.post("/api/scheduled/reminders", async (req: Request, res: Response) => {
    if (!(await authorize(req))) { res.status(401).json({ error: "Unauthorized." }); return; }
    const result = await runReminderSweep().catch(error => ({ error: String(error) }));
    respond(res, result);
  });

  app.post("/api/scheduled/digest", async (req: Request, res: Response) => {
    if (!(await authorize(req))) { res.status(401).json({ error: "Unauthorized." }); return; }
    const result = await runDigestSweep().catch(error => ({ error: String(error) }));
    respond(res, result);
  });

  app.post("/api/scheduled/purge", async (req: Request, res: Response) => {
    if (!(await authorize(req))) { res.status(401).json({ error: "Unauthorized." }); return; }
    const result = await runPurgeSweep().catch(error => ({ error: String(error) }));
    respond(res, result);
  });
}

const DAILY_JOBS = [
  { name: "tasknest-reminders", cron: "0 7 * * *", path: "/api/scheduled/reminders" },
  { name: "tasknest-digest", cron: "0 8 * * *", path: "/api/scheduled/digest" },
  { name: "tasknest-purge", cron: "0 3 * * *", path: "/api/scheduled/purge" },
] as const;

/**
 * Upserts the three daily heartbeat jobs by name so repeated deploys never
 * duplicate schedules. Failures are swallowed: the routes remain callable
 * (e.g. by an external scheduler) even when the platform job API is absent.
 */
export async function ensureDailyHeartbeatJobs() {
  for (const job of DAILY_JOBS) {
    try {
      const existing = await listHeartbeatJobs("");
      if (existing.jobs.some(candidate => candidate.name === job.name)) continue;
      await createHeartbeatJob({ name: job.name, cron: job.cron, path: job.path, method: "POST", payload: {} }, "");
    } catch {
      // Job registration is best-effort; the manual POST routes still work.
    }
  }
}

