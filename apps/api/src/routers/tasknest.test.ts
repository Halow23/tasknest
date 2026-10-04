import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import type { TaskDoc } from "../firestore/types";

const assertWorkspaceMember = vi.fn();
const getProjectById = vi.fn();
const createNotification = vi.fn().mockResolvedValue(undefined);
const listTasks = vi.fn().mockResolvedValue([]);
const getOpenDependencyIds = vi.fn().mockResolvedValue(new Set<string>());
const getTaskById = vi.fn();
const addDependency = vi.fn().mockResolvedValue(undefined);
const removeDependency = vi.fn().mockResolvedValue(undefined);
const listDeletedTasks = vi.fn().mockResolvedValue([]);
const getLabels = vi.fn().mockResolvedValue([]);
const tasksColDelete = vi.fn().mockResolvedValue(undefined);

vi.mock("../firestore/task", () => ({
  addDependency,
  addSubtask: vi.fn(),
  assertTaskMember: vi.fn(),
  createAttachment: vi.fn(),
  createComment: vi.fn(),
  createLabel: vi.fn(),
  createTask: vi.fn(),
  createTimeEntry: vi.fn(),
  deleteLabel: vi.fn(),
  deleteSubtask: vi.fn(),
  deleteTimeEntry: vi.fn(),
  getLabels,
  getOpenDependencies: vi.fn(),
  getOpenDependencyIds,
  getTaskById,
  getTaskDetail: vi.fn(),
  listDeletedTasks,
  listTasks,
  logActivity: vi.fn(),
  removeDependency,
  restoreTask: vi.fn(),
  searchTasks: vi.fn(),
  softDeleteTask: vi.fn(),
  toggleSubtask: vi.fn(),
  updateLabel: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("../firestore/workspace", () => ({
  assertProjectMember: vi.fn(),
  assertWorkspaceMember,
  createInvite: vi.fn(),
  createNotification,
  createWorkspace: vi.fn(),
  getActiveProjects: vi.fn(),
  getInviteByToken: vi.fn(),
  getNotificationsForUser: vi.fn(),
  getProjectById,
  getWorkspaceById: vi.fn(),
  getWorkspaceForUser: vi.fn(),
  getWorkspaceMember: vi.fn(),
  markNotificationsRead: vi.fn(),
}));

vi.mock("../events", () => ({ publishWorkspaceEvent: vi.fn() }));

function chainableQuery() {
  const query: Record<string, unknown> = {};
  query.where = vi.fn(() => query);
  query.orderBy = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.get = vi.fn().mockResolvedValue({ docs: [] });
  return query;
}

vi.mock("../firestore/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../firestore/db")>();
  return {
    db: vi.fn(() => ({})),
    getDoc: vi.fn(),
    getDocs: vi.fn(async () => []),
    invitesCol: vi.fn(() => chainableQuery()),
    labelsCol: vi.fn(() => chainableQuery()),
    projectsCol: vi.fn(() => {
      const col = chainableQuery() as Record<string, unknown>;
      col.doc = vi.fn(() => ({ delete: tasksColDelete, update: vi.fn() }));
      return col;
    }),
    tasksCol: vi.fn(() => {
      const col = chainableQuery() as Record<string, unknown>;
      col.doc = vi.fn(() => ({ delete: tasksColDelete, update: vi.fn() }));
      return col;
    }),
    templatesCol: vi.fn(() => chainableQuery()),
    automationRulesCol: vi.fn(() => chainableQuery()),
    timeEntriesCol: vi.fn(() => chainableQuery()),
    toDate: actual.toDate,
    toDateOrNull: actual.toDateOrNull,
    toPlainDoc: actual.toPlainDoc,
    usersCol: vi.fn(() => chainableQuery()),
    workspaceDoc: vi.fn(),
    workspacesCol: vi.fn(() => chainableQuery()),
  };
});

const { tasknestRouter } = await import("./tasknest");

const user = {
  id: "user-1",
  openId: "user-1",
  name: "Test User",
  email: "user@foundationu.com",
  loginMethod: "firebase",
  role: "member" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(): TrpcContext {
  return {
    user,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function workspace() {
  return {
    id: "ws1",
    name: "Workspace",
    ownerId: "user-1",
    members: [{ userId: "user-1", name: "Test User", email: "user@foundationu.com", role: "member" }],
  };
}

function task(id: string, overrides: Partial<TaskDoc> = {}): TaskDoc {
  return {
    id,
    wsId: "ws1",
    projectId: "p1",
    title: `Task ${id}`,
    titleLower: `task ${id}`,
    status: "todo",
    priority: "medium",
    assigneeIds: [],
    labelIds: [],
    dependencies: [],
    subtasks: [],
    recurrenceRule: "none",
    dueAt: null,
    completedAt: null,
    deletedAt: null,
    sortOrder: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
    ...overrides,
  } as TaskDoc;
}

beforeEach(() => {
  vi.clearAllMocks();
  assertWorkspaceMember.mockResolvedValue(workspace());
  getProjectById.mockResolvedValue({ id: "p1", name: "Project", deletedAt: null });
});

describe("task.list", () => {
  it("returns the project alongside its tasks", async () => {
    listTasks.mockResolvedValue([task("t1"), task("t2")]);

    const caller = tasknestRouter.createCaller(createContext());
    const result = await caller.task.list({ projectId: "p1", workspaceId: "ws1" });

    expect(result.tasks).toHaveLength(2);
    expect(result.project.id).toBe("p1");
  });

  it("rejects the list when the project does not exist", async () => {
    getProjectById.mockResolvedValue(null);

    const caller = tasknestRouter.createCaller(createContext());
    await expect(caller.task.list({ projectId: "missing", workspaceId: "ws1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("trash", () => {
  it("purges a task permanently by id", async () => {
    const caller = tasknestRouter.createCaller(createContext());
    const result = await caller.trash.purgeTask({ taskId: "t1", workspaceId: "ws1" });

    expect(result.purgedTaskId).toBe("t1");
    expect(tasksColDelete).toHaveBeenCalled();
  });

  it("lists deleted tasks with their project names resolved", async () => {
    listDeletedTasks.mockResolvedValue([task("t1", { deletedAt: new Date() })]);
    const caller = tasknestRouter.createCaller(createContext());
    const result = await caller.trash.list({ workspaceId: "ws1" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].projectName).toBe("Unknown project");
  });
});
