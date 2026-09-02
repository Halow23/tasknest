import { EventEmitter } from "events";

/**
 * In-process pub/sub for workspace activity. logActivity() publishes every
 * mutation event here; the /api/events SSE route subscribes per connected
 * client and streams events scoped to that client's workspace.
 */
export const workspaceEvents = new EventEmitter();
workspaceEvents.setMaxListeners(200);

export type WorkspaceEvent = {
  workspaceId: string;
  type: string;
  projectId?: string | null;
  taskId?: string | null;
  actorId: string;
  at: string;
};

export function publishWorkspaceEvent(event: WorkspaceEvent) {
  workspaceEvents.emit("event", event);
}
