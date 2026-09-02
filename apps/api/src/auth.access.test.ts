import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(accessDenied: boolean): TrpcContext {
  return {
    user: null,
    accessDenied,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.access", () => {
  it("reports a university-email denial for a blocked session", async () => {
    const caller = appRouter.createCaller(createContext(true));

    await expect(caller.auth.access()).resolves.toEqual({ denied: true });
  });

  it("does not report a denial for a normally signed-out visitor", async () => {
    const caller = appRouter.createCaller(createContext(false));

    await expect(caller.auth.access()).resolves.toEqual({ denied: false });
  });
});
