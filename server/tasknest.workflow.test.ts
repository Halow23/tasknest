import { vi } from "vitest";

const state = vi.hoisted(() => ({
  firstWorkspace: undefined as { id: number; name: string; ownerId: number; createdAt: Date; updatedAt: Date } | undefined,
  workspaceMember: { id: 1 } as { id: number } | undefined,
  project: { id: 10, workspaceId: 4, name: "Launch", color: "#38A9F2", archived: false, createdById: 1, createdAt: new Date(), updatedAt: new Date() },
  taskProject: {
    task: { id: 88, projectId: 10, title: "Live task", description: null, status: "backlog" as const, priority: "medium" as const, dueAt: null, sortOrder: 1, createdById: 1, completedAt: null, createdAt: new Date(), updatedAt: new Date() },
    project: { id: 10, workspaceId: 4, name: "Launch", color: "#38A9F2", archived: false, createdById: 1, createdAt: new Date(), updatedAt: new Date() },
  },
  selectRows: [] as unknown[],
  createdWorkspace: { id: 4, name: "Operations", ownerId: 1, createdAt: new Date(), updatedAt: new Date() },
  storagePut: vi.fn().mockResolvedValue({ key: "tasknest/test.txt", url: "/manus-storage/tasknest/test.txt" }),
}));

function operation<T>(result: T) {
  return {
    onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined),
    then: (resolve: (value: T) => unknown, reject: (reason?: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
}

function selectChain() {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(state.selectRows)),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => selectChain()),
  insert: vi.fn(() => ({ values: vi.fn(() => operation([{ insertId: 88 }])) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  transaction: vi.fn(async (callback: (tx: typeof mockDb) => Promise<unknown>) => callback(mockDb)),
};

vi.mock("./db", () => ({
  requireDb: vi.fn(async () => mockDb),
  getFirstWorkspaceForUser: vi.fn(async () => state.firstWorkspace),
  createWorkspaceForUser: vi.fn(async () => state.createdWorkspace),
  getWorkspaceMember: vi.fn(async () => state.workspaceMember),
  getProjectForWorkspace: vi.fn(async () => state.project),
  getTaskProject: vi.fn(async () => state.taskProject),
}));

vi.mock("./storage", () => ({ storagePut: state.storagePut }));

import { describe, beforeEach, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function authedContext(): TrpcContext {
  return {
    user: { id: 1, openId: "workflow-user", name: "Workflow User", email: "workflow@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("TaskNest live collaboration workflows", () => {
  beforeEach(() => {
    state.firstWorkspace = undefined;
    state.workspaceMember = { id: 1 };
    state.selectRows = [];
    state.storagePut.mockClear();
    mockDb.insert.mockClear(); mockDb.update.mockClear(); mockDb.select.mockClear(); mockDb.transaction.mockClear();
  });

  it("creates a first private workspace without seeding work data", async () => {
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.workspace.create({ name: "Operations" })).resolves.toMatchObject({ id: 4, name: "Operations" });
  });

  it("creates a member-scoped project and a real task", async () => {
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.project.create({ workspaceId: 4, name: "Launch", color: "#38A9F2" })).resolves.toMatchObject({ id: 10, name: "Launch" });
    state.selectRows = [state.project];
    await expect(caller.tasknest.task.create({ projectId: 10, title: "Confirm live task persistence" })).resolves.toMatchObject({ id: 88, title: "Live task" });
  });

  it("persists a Kanban move and collaboration mutations for a workspace member", async () => {
    state.selectRows = [state.project];
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.task.move({ taskId: 88, status: "review" })).resolves.toMatchObject({ id: 88 });
    await expect(caller.tasknest.subtask.create({ taskId: 88, title: "Check live updates" })).resolves.toEqual({ id: 88 });
    await expect(caller.tasknest.comment.create({ taskId: 88, body: "This is stored for the team." })).resolves.toEqual({ id: 88 });
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("blocks a member from reading another workspace's projects", async () => {
    state.workspaceMember = undefined;
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.project.list({ workspaceId: 999 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts a valid invitation and rejects oversized attachment input", async () => {
    state.selectRows = [{ id: 3, workspaceId: 4, token: "a".repeat(32), createdById: 1, expiresAt: new Date(Date.now() + 60_000), acceptedAt: null, acceptedById: null, createdAt: new Date() }];
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.workspace.acceptInvite({ token: "a".repeat(32) })).resolves.toEqual({ workspaceId: 4 });
    await expect(caller.tasknest.attachment.upload({ taskId: 88, fileName: "large.txt", contentType: "text/plain", dataBase64: "a".repeat(7_000_001) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.storagePut).not.toHaveBeenCalled();
  });

  it("stores attachment bytes outside the database and persists only their reference", async () => {
    state.selectRows = [state.project];
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.attachment.upload({
      taskId: 88,
      fileName: "handoff.txt",
      contentType: "text/plain",
      dataBase64: Buffer.from("durable task context").toString("base64"),
    })).resolves.toMatchObject({ id: 88, key: "tasknest/test.txt", url: "/manus-storage/tasknest/test.txt" });
    expect(state.storagePut).toHaveBeenCalledWith(
      "tasknest/4/tasks/88/handoff.txt",
      expect.any(Buffer),
      "text/plain",
    );
  });
});
