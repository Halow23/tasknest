import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { getFirebaseAuth } from "@/lib/firebase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { applyStoredThemeBeforePaint } from "./contexts/ThemeContext";
import { WorkspaceInviteControl } from "./components/WorkspaceInviteControl";
import "./index.css";

// Apply the stored theme before React mounts so dark mode paints without a flash.
applyStoredThemeBeforePaint();

const queryClient = new QueryClient();

// tRPC keys a query as [["auth", "me"], input]; the first element is the path.
const isAuthMeKey = (key: readonly unknown[]) => {
  const [path] = key;
  return Array.isArray(path) && path.join(".") === "auth.me";
};

// With Firebase Auth the session lives in the browser; an UNAUTHED error from
// the API means the ID token was stale (they rotate ~hourly) or was rejected.
// The query/mutation caches below invalidate `auth.me` so the UI recomputes
// from the current Firebase session instead of hard-navigating to a login.
// A failure of `auth.me` itself is excluded: invalidating a query because that
// same query failed would refetch it in a loop.
const handleUnauthorized = (error: unknown, queryKey?: readonly unknown[]) => {
  if (!(error instanceof TRPCClientError)) return;
  if (error.message !== UNAUTHED_ERR_MSG) return;
  if (queryKey && isAuthMeKey(queryKey)) return;
  queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
};

/**
 * True when a failure is an expected consequence of being signed out. After
 * sign-out the in-flight queries settle with UNAUTHORIZED; that is the correct
 * answer, not a defect, so it should not be reported as an API error. Genuine
 * 401s during an active session (a stale ID token) still log, because a
 * current Firebase user exists in that case.
 */
const isExpectedSignedOutError = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return false;
  if (error.message !== UNAUTHED_ERR_MSG) return false;
  return getFirebaseAuth().currentUser === null;
};

/**
 * Single entry point for every failed query/mutation. A signed-out 401 is the
 * expected end state, so it is dropped before anything reacts to it: there is
 * no session to re-verify, and re-fetching `auth.me` here would only produce
 * another 401. Every other UNAUTHED failure gets a readable log line.
 */
const reportApiError = (
  error: unknown,
  source: "query" | "mutation",
  label: string,
  queryKey?: readonly unknown[],
) => {
  if (isExpectedSignedOutError(error)) return;
  handleUnauthorized(error, queryKey);
  logApiError(describeApiError(error, source, label));
};

/**
 * Readable tRPC failure report. A raw TRPCClientError dumps an unreadable
 * object graph and hides the two things that actually matter: which procedure
 * failed and why. This flattens it to a single line plus an optional hint.
 */
const describeApiError = (error: unknown, source: "query" | "mutation", label: string) => {
  if (error instanceof TRPCClientError) {
    const data = error.data as { httpStatus?: number; code?: string; path?: string } | undefined;
    const status = data?.httpStatus ?? "??";
    const code = data?.code ?? "UNKNOWN";
    const lines = [`[API ${source}] ${label} -> HTTP ${status} (${code})`];
    lines.push(`  ${error.message.split("\n")[0]}`);

    // Firestore composite-index failures carry a long console URL. Surface it on
    // its own line so it is clickable instead of buried mid-sentence.
    const indexUrl = error.message.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
    if (indexUrl) {
      lines.push("  Firestore needs a composite index. Create it here:");
      lines.push(`  ${indexUrl}`);
    }
    return lines.join("\n");
  }
  return `[API ${source}] ${label} -> ${String(error)}`;
};

// A failing query that polls (e.g. refetchInterval: 30s) would otherwise log
// the identical error forever. Log each distinct failure once per minute.
const LOG_THROTTLE_MS = 60_000;
const lastLoggedAt = new Map<string, number>();
const logApiError = (message: string) => {
  const key = message.split("\n")[0];
  const now = Date.now();
  const previous = lastLoggedAt.get(key);
  if (previous && now - previous < LOG_THROTTLE_MS) return;
  lastLoggedAt.set(key, now);
  console.error(message);
};

/**
 * Procedure label from a react-query key. tRPC builds the key as
 * [["tasknest", "task", "myTasks"], input], so the first element is the
 * procedure path. Falls back to the raw key for non-tRPC queries.
 */
const labelFromKey = (key: readonly unknown[]) => {
  const [path] = key;
  if (Array.isArray(path) && path.length > 0) return path.join(".");
  if (typeof path === "string") return path;
  return "unknown";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type !== "updated" || event.action.type !== "error") return;
  reportApiError(
    event.query.state.error,
    "query",
    labelFromKey(event.query.queryKey),
    event.query.queryKey,
  );
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type !== "updated" || event.action.type !== "error") return;
  const key = event.mutation.options.mutationKey;
  reportApiError(
    event.mutation.state.error,
    "mutation",
    key ? labelFromKey(key) : "mutation",
  );
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      // In dev, Vite proxies /api to the API server (see vite.config.ts); in
      // production the API lives on its own host.
      url: import.meta.env.VITE_API_URL || "/api/trpc",
      transformer: superjson,
      headers: async () => {
        // Attach the Firebase ID token to every request. getToken() serves the
        // cached token and transparently refreshes it when it is close to
        // expiry, so no manual refresh scheduling is needed.
        const { currentUser } = getFirebaseAuth();
        if (!currentUser) return {};
        const token = await currentUser.getIdToken();
        return { Authorization: `Bearer ${token}` };
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
      <WorkspaceInviteControl />
    </QueryClientProvider>
  </trpc.Provider>
);
