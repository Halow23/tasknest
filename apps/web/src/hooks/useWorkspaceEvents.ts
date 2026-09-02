import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { getFirebaseAuth } from "@/lib/firebase";

/**
 * Subscribes to the workspace SSE stream and invalidates the affected
 * react-query caches when teammates create, move, or comment on tasks.
 * Self-authored events are skipped — the optimistic mutations have already
 * applied those changes locally, so refetching them would only clobber
 * in-flight updates. EventSource reconnects automatically; the existing
 * polling stays as a fallback for missed events.
 *
 * Auth: EventSource cannot set headers, so the Firebase ID token rides in
 * the ?token= query param. ID tokens rotate ~hourly; when the server starts
 * rejecting a stale one the stream errors and we reconnect with a fresh
 * token (getIdToken refreshes as needed).
 */
export function useWorkspaceEvents(options: { enabled: boolean; currentUserId?: string | null }) {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!options.enabled || typeof window === "undefined") return;
    let source: EventSource | null = null;
    let closed = false;

    const connect = async () => {
      if (closed) return;
      const { currentUser } = getFirebaseAuth();
      const token = currentUser ? await currentUser.getIdToken() : null;
      if (closed || !token) return;

      const base = import.meta.env.VITE_API_URL?.replace(/\/api\/trpc$/, "") ?? "";
      source = new EventSource(`${base}/api/events?token=${encodeURIComponent(token)}`);
      source.onmessage = event => {
        try {
          const payload = JSON.parse(event.data) as { type: string; taskId?: string | null; actorId?: string | null };
          if (payload.type === "connected") return;
          if (payload.actorId != null && payload.actorId === options.currentUserId) return;
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
        // Drop the connection and re-open with a (possibly refreshed) token;
        // if sign-out caused the error, connect() exits early instead.
        source?.close();
        source = null;
        if (!closed) {
          setTimeout(() => { void connect(); }, 3000);
        }
      };
    };

    void connect();
    return () => {
      closed = true;
      source?.close();
    };
  }, [options.enabled, options.currentUserId, queryClient, utils.tasknest.task.detail]);
}
