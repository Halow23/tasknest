import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getTaskNestEmailAccess, recordDeniedSignIn } from "../firestore/access";
import { authenticateRequest, type AuthenticatedUser } from "./firebaseAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  accessDenied: boolean;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;
  let accessDenied = false;

  try {
    user = await authenticateRequest(opts.req);

    // Authenticated users must obey the email allowlist
    if (user && !user.isCron) {
      const accessDecision = await getTaskNestEmailAccess(user.email);
      if (!accessDecision.allowed) {
        await recordDeniedSignIn({
          attemptedEmail: user.email,
          loginMethod: user.loginMethod,
          reason: accessDecision.reason ?? "email_not_approved",
        }).catch(() => undefined);
        user = null;
        accessDenied = true;
      }
    }
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    accessDenied,
  };
}
