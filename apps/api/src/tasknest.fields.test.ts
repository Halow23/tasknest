import { vi } from "vitest";
import { getTableName } from "drizzle-orm";

const state = vi.hoisted(() => ({
  project: { id: 10, workspaceId: 4, name: "Launch", color: "#38A9F2", archived: false, createdById: 1, createdAt: new Date(), updatedAt: new Date() },
  taskProject: {
    task: { id: 88, projectId: 10, title: "Live task", description: null, status: "backlog" as const, priority: "medium" as const, dueAt: null, sortOrder: 1, createdById: 1, completedAt: null, createdAt: new Date(), updatedAt: new Date() },
    project: { id: 10, workspaceId: 4, name: "Launch", color: "#38A9F2", archived: false, createdById: 1, createdAt: new Date(), updatedAt: new Date() },
  },
  workspaceMember: { id: 1 } as { id: number } | undefined,
  /** Per-table select results, keyed by drizzle table name (e.g. "projects", "project_fields"). */
  tableRows: {} as Record<string, unknown[]>,
  insertedValues: vi.fn(),
}));

function operation<T>(result: T) {
  return {
    onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined),
    then: (resolve: (value: T) => unknown, reject: (reason?: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
}

function selectChain(table?: { name?: string } & object) {
  const tableName = table ? getTableName(table as never) : undefined;
  const rows = tableName === "projects" ? [state.project] : (tableName ? state.tableRows[tableName] ?? [] : []);
  const chain = {
    from: vi.fn((fromTable: object) => selectChain(fromTable)),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    then: (resolve: (value: unknown[]) => unknown, reject: (reason?: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => selectChain()),
  insert: vi.fn(() => ({ values: vi.fn((values: unknown) => { state.insertedValues(values); return operation([{ insertId: 555 }]); }) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  transaction: vi.fn(async (callback: (tx: typeof mockDb) => Promise<unknown>) => callback(mockDb)),
};

vi.mock("./db", () => ({
  requireDb: vi.fn(async () => mockDb),
  getFirstWorkspaceForUser: vi.fn(async () => undefined),
  createWorkspaceForUser: vi.fn(async () => undefined),
  getWorkspaceMember: vi.fn(async () => state.workspaceMember),
  getProjectForWorkspace: vi.fn(async () => state.project),
  getTaskProject: vi.fn(async () => state.taskProject),
}));

vi.mock("./storage", () => ({ storagePut: vi.fn() }));
vi.mock("./invitationEmail", () => ({ sendWorkspaceInvitationEmail: vi.fn() }));

import { describe, beforeEach, expect, it } from "vitest";
import { appRouter } from "./routers";
import { projectFields } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

function authedContext(): TrpcContext {
  return {
    user: { id: 1, openId: "fields-user", name: "Fields User", email: "fields@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("TaskNest custom field workflows", () => {
  beforeEach(() => {
    state.workspaceMember = { id: 1 };
    state.tableRows = {};
    state.insertedValues.mockClear();
    mockDb.insert.mockClear(); mockDb.update.mockClear(); mockDb.select.mockClear(); mockDb.delete.mockClear(); mockDb.transaction.mockClear();
  });

  it("creates a dropdown field with options and rejects duplicates", async () => {
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.field.create({ projectId: 10, name: "Department", type: "select", options: ["Design", "Development"] })).resolves.toEqual({ fieldId: 555, projectId: 10 });
    expect(state.insertedValues).toHaveBeenCalledWith(expect.objectContaining({ name: "Department", type: "select", options: ["Design", "Development"] }));

    state.tableRows[getTableName(projectFields)] = [{ id: 1 }];
    await expect(caller.tasknest.field.create({ projectId: 10, name: "Department", type: "text" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires options for dropdown fields", async () => {
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.field.create({ projectId: 10, name: "Stage", type: "select" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lists project fields for members and guards non-members", async () => {
    state.tableRows[getTableName(projectFields)] = [{ id: 1, projectId: 10, name: "Department", type: "select", options: ["Design"], sortOrder: 0, createdById: 1, createdAt: new Date(), updatedAt: new Date() }];
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.field.list({ projectId: 10 })).resolves.toHaveLength(1);

    state.workspaceMember = undefined;
    await expect(caller.tasknest.field.list({ projectId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deletes a field through the membership guard", async () => {
    state.tableRows[getTableName(projectFields)] = [{ field: { id: 7, projectId: 10, name: "Department", type: "text", options: null, sortOrder: 0, createdById: 1, createdAt: new Date(), updatedAt: new Date() }, workspaceId: 4 }];
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.field.delete({ fieldId: 7 })).resolves.toEqual({ deletedFieldId: 7 });
    expect(mockDb.delete).toHaveBeenCalled();

    state.workspaceMember = undefined;
    await expect(caller.tasknest.field.delete({ fieldId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("persists valid field values when creating a task", async () => {
    state.tableRows[getTableName(projectFields)] = [
      { id: 1, projectId: 10, name: "Department", type: "select", options: ["Design", "Development"], sortOrder: 0, createdById: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, projectId: 10, name: "Review date", type: "date", options: null, sortOrder: 1, createdById: 1, createdAt: new Date(), updatedAt: new Date() },
    ];
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.task.create({
      projectId: 10,
      title: "Fielded task",
      fieldValues: [{ fieldId: 1, value: "Design" }, { fieldId: 2, value: "2026-09-01" }],
    })).resolves.toEqual({ taskId: 555, projectId: 10 });
    expect(state.insertedValues).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ fieldId: 1, value: "Design" }),
      expect.objectContaining({ fieldId: 2, value: "2026-09-01" }),
    ]));
  });

  it("rejects dropdown values outside the defined options", async () => {
    state.tableRows[getTableName(projectFields)] = [{ id: 1, projectId: 10, name: "Department", type: "select", options: ["Design"], sortOrder: 0, createdById: 1, createdAt: new Date(), updatedAt: new Date() }];
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.task.create({ projectId: 10, title: "Bad value", fieldValues: [{ fieldId: 1, value: "Marketing" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects malformed dates and fields from other projects", async () => {
    state.tableRows[getTableName(projectFields)] = [{ id: 2, projectId: 10, name: "Review date", type: "date", options: null, sortOrder: 1, createdById: 1, createdAt: new Date(), updatedAt: new Date() }];
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.task.create({ projectId: 10, title: "Bad date", fieldValues: [{ fieldId: 2, value: "not-a-date" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    state.tableRows[getTableName(projectFields)] = [{ id: 3, projectId: 999, name: "Other project field", type: "text", options: null, sortOrder: 0, createdById: 1, createdAt: new Date(), updatedAt: new Date() }];
    await expect(caller.tasknest.task.create({ projectId: 10, title: "Foreign field", fieldValues: [{ fieldId: 3, value: "nope" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("replaces stored field values on task update and drops empty values", async () => {
    state.tableRows[getTableName(projectFields)] = [{ id: 1, projectId: 10, name: "Department", type: "select", options: ["Design", "Development"], sortOrder: 0, createdById: 1, createdAt: new Date(), updatedAt: new Date() }];
    const caller = appRouter.createCaller(authedContext());
    await expect(caller.tasknest.task.update({
      taskId: 88,
      fieldValues: [{ fieldId: 1, value: "Development" }, { fieldId: 1, value: "" }],
    })).resolves.toEqual({ taskId: 88, projectId: 10 });
    expect(mockDb.delete).toHaveBeenCalled();
    expect(state.insertedValues).not.toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ value: "" })]));
  });
});
