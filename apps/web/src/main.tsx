import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { getFirebaseAuth } from "@/lib/firebase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { WorkspaceInviteControl } from "./components/WorkspaceInviteControl";
import "./index.css";

const queryClient = new QueryClient();

// With Firebase Auth the session lives in the browser; an UNAUTHED error from
// the API means the ID token was stale (they rotate ~hourly) or was rejected.
// The query/mutation caches below invalidate `auth.me` so the UI recomputes
// from the current Firebase session instead of hard-navigating to a login.
const handleUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (error.message !== UNAUTHED_ERR_MSG) return;
  queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    handleUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    handleUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
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
