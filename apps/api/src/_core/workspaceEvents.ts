import type { Express, Request, Response } from "express";
import { workspaceEvents, type WorkspaceEvent } from "../events";
import { getFirstWorkspaceForUser } from "../db";
import { sdk, type AuthenticatedUser } from "./sdk";

/**
 * Server-sent events stream of workspace activity for the signed-in user's
 * workspace. Authenticates through the same session cookie as tRPC, then
 * streams every published event scoped to the user's workspace with a 25s
 * heartbeat comment to keep intermediaries from closing the connection.
 */
export function registerWorkspaceEvents(app: Express) {
  app.get("/api/events", async (req: Request, res: Response) => {
    let user: AuthenticatedUser | null = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      user = null;
    }
    if (!user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    const workspace = await getFirstWorkspaceForUser(user.id);
    if (!workspace) {
      res.status(404).json({ error: "No workspace." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`data: ${JSON.stringify({ type: "connected", workspaceId: workspace.id })}\n\n`);

    const listener = (event: WorkspaceEvent) => {
      if (event.workspaceId !== workspace.id) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    workspaceEvents.on("event", listener);

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      workspaceEvents.off("event", listener);
    };
    req.on("close", cleanup);
    res.on("close", cleanup);
  });
}
