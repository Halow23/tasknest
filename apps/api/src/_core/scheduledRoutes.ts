import type { Express, Request, Response } from "express";
import { ENV } from "./env";
import { authenticateRequest } from "./firebaseAuth";
import { runDigestSweep, runPurgeSweep, runReminderSweep } from "../scheduledJobs";

/**
 * Cron entry points. Cloud Scheduler (or any scheduler) POSTs to these routes
 * with the shared CRON_SECRET (header `x-cron-secret` or body `cronSecret`);
 * authenticated users may also trigger them manually.
 */
async function authorize(req: Request): Promise<boolean> {
  const bodySecret = (req.body ?? {})["cronSecret"] ?? req.header("x-cron-secret");
  if (bodySecret && ENV.cronSecret && bodySecret === ENV.cronSecret) return true;
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
