import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { ENV } from "./env";
import { authenticateRequest } from "./firebaseAuth";
import { runDigestSweep, runPurgeSweep, runReminderSweep } from "../scheduledJobs";

/**
 * Cron entry points. Cloud Scheduler (or any scheduler) POSTs to these routes
 * with the shared CRON_SECRET (header `x-cron-secret` or body `cronSecret`).
 * In non-production, signed-in users may also trigger them manually.
 */
function secretsMatch(provided: string): boolean {
  if (!ENV.cronSecret) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(ENV.cronSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorize(req: Request): Promise<boolean> {
  const bodySecret = (req.body ?? {})["cronSecret"] ?? req.header("x-cron-secret");
  if (bodySecret && secretsMatch(bodySecret)) return true;
  if (ENV.isProduction) return false;
  try {
    const user = await authenticateRequest(req);
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
