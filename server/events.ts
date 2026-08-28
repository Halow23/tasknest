import { EventEmitter } from "events";

/**
 * In-process pub/sub for workspace activity. logActivity() publishes every
 * mutation event here; the /api/events SSE route subscribes per connected
 * client and streams events scoped to that client's workspace.
 */
export const workspaceEvents = new EventEmitter();
// A single process never has thousands of concurrent SSE clients; raise the
// default (10) so each open connection can subscribe without warnings.
workspaceEvents.setMaxListeners(200);

export type WorkspaceEvent = {
  workspaceId: number;
  type: string;
  projectId?: number | null;
  taskId?: number | null;
  actorId: number;
  at: string;
};

export function publishWorkspaceEvent(event: WorkspaceEvent) {
  workspaceEvents.emit("event", event);
}
