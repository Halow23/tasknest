import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("tasknest protected workspace procedures", () => {
  it("rejects workspace reads when there is no authenticated user", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.tasknest.workspace.current()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects an empty task title before database work begins", async () => {
    const caller = appRouter.createCaller(createContext({
      id: 99,
      openId: "test-member",
      name: "Test Member",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.tasknest.task.create({ projectId: 1, title: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("accepts only the defined Kanban status values", async () => {
    const caller = appRouter.createCaller(createContext({
      id: 99,
      openId: "test-member",
      name: "Test Member",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.tasknest.task.move({ taskId: 1, status: "archived" as "backlog" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
