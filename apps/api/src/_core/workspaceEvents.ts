import type { Express, Request, Response } from "express";
import { workspaceEvents, type WorkspaceEvent } from "../events";
import { getWorkspaceForUser } from "../firestore/workspace";
import { authenticateRequest, type AuthenticatedUser } from "./firebaseAuth";

/**
 * Server-sent events stream of workspace activity for the signed-in user's
 * workspace. Authenticates with the Firebase ID token (Authorization header,
 * or ?token= since EventSource cannot set headers), then streams every
 * published event scoped to the user's workspace with a 25s heartbeat
 * comment to keep intermediaries from closing the connection.
 */
export function registerWorkspaceEvents(app: Express) {
  app.get("/api/events", async (req: Request, res: Response) => {
    // Express 4 does not catch rejected promises from async handlers, so an
    // unguarded throw here leaves the request hanging with no response.
    // Every failure path must end in an explicit status.
    try {
      let user: AuthenticatedUser | null = null;
      try {
        user = await authenticateRequest(req);
      } catch {
        user = null;
      }
      if (!user) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      let workspace: Awaited<ReturnType<typeof getWorkspaceForUser>> = null;
      try {
        workspace = await getWorkspaceForUser(user.id);
      } catch {
        workspace = null;
      }
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
        if (res.writableEnded) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };
      workspaceEvents.on("event", listener);

      const heartbeat = setInterval(() => {
        if (res.writableEnded) return;
        res.write(": heartbeat\n\n");
      }, 25_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        workspaceEvents.off("event", listener);
      };
      req.on("close", cleanup);
      res.on("close", cleanup);
    } catch (error) {
      // The response may already have started (SSE headers sent); only send a
      // JSON error when nothing has been written yet.
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to open the event stream." });
      } else {
        res.end();
      }
      console.error("[api/events] stream setup failed:", error);
    }
  });
}
