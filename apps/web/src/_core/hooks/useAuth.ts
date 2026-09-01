import { startLogin } from "@/const";
import { getFirebaseAuth } from "@/lib/firebase";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/**
 * Auth state = Firebase session (the identity) + the server's user record
 * (the numeric id, role, and allowlist verdict). `isAuthenticated` is only
 * true once the server has accepted the Firebase identity, so access-denied
 * users never see app data.
 */
export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const [firebaseUser, setFirebaseUser] = useState<{
    uid: string;
    email: string | null;
    displayName: string | null;
  } | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setFirebaseUser(
        user
          ? { uid: user.uid, email: user.email, displayName: user.displayName }
          : null
      );
      setFirebaseReady(true);
    });
    return unsubscribe;
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: firebaseReady,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        // Expected when the session already expired server-side.
      } else {
        throw error;
      }
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: !firebaseReady || meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    firebaseReady,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (!firebaseReady || meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    if (redirectPath) {
      window.location.href = redirectPath;
      return;
    }
    void startLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    firebaseReady,
    meQuery.isLoading,
    logoutMutation.isPending,
    state.user,
  ]);

  return { ...state, logout, firebaseUser };
}
