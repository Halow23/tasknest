import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { COOKIE_NAME } from "@shared/const";
import { getTaskNestEmailAccess } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk, type AuthenticatedUser } from "./sdk";

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
    user = await sdk.authenticateRequest(opts.req);

    // Previously issued sessions must obey the same rule as new OAuth logins.
    // Scheduled service identities do not represent end-user email logins.
    if (user && !user.isCron) {
      const accessDecision = await getTaskNestEmailAccess(user.email);
      if (!accessDecision.allowed) {
        const cookieOptions = getSessionCookieOptions(opts.req);
        opts.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        user = null;
        accessDenied = true;
      }
    }
  } catch (error) {
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
