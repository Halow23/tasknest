import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

/**
 * Subscribes to the workspace SSE stream at /api/events and invalidates the
 * affected react-query caches when teammates create, move, or comment on
 * tasks. EventSource reconnects automatically; the existing polling stays as
 * a fallback for missed events.
 */
export function useWorkspaceEvents(options: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!options.enabled || typeof window === "undefined") return;
    let source: EventSource | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource("/api/events");
      source.onmessage = event => {
        try {
          const payload = JSON.parse(event.data) as { type: string; taskId?: number | null };
          if (payload.type === "connected") return;
          queryClient.invalidateQueries({ queryKey: [["tasknest", "task", "list"]] });
          queryClient.invalidateQueries({ queryKey: [["tasknest", "task", "detail"]] });
          queryClient.invalidateQueries({ queryKey: [["tasknest", "analytics", "project"]] });
          queryClient.invalidateQueries({ queryKey: [["tasknest", "task", "myTasks"]] });
          queryClient.invalidateQueries({ queryKey: [["tasknest", "notification", "list"]] });
          if (payload.type === "comment_added" || payload.type === "subtask_updated") {
            utils.tasknest.task.detail.invalidate();
          }
        } catch {
          // Ignore malformed frames; the stream reconnects on its own.
        }
      };
      source.onerror = () => {
        // EventSource retries on its own; nothing to do beyond dropping the ref.
      };
    };

    connect();
    return () => {
      closed = true;
      source?.close();
    };
  }, [options.enabled, queryClient, utils.tasknest.task.detail]);
}
