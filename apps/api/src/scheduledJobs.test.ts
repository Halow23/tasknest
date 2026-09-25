import { beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const createNotification = vi.fn().mockResolvedValue(undefined);
const getNotificationsForUser = vi.fn().mockResolvedValue([]);
const getUserByUid = vi.fn().mockResolvedValue({ preferences: { emailDigest: true } });
const sendDailyDigestEmail = vi.fn().mockResolvedValue("digest-1");

vi.mock("./firestore/workspace", () => ({
  createNotification,
  getNotificationsForUser,
  getUserByUid,
  markNotificationsRead: vi.fn(),
}));

vi.mock("./digestEmail", () => ({ sendDailyDigestEmail }));
vi.mock("./trash", () => ({ purgeExpiredDeletedItems: vi.fn().mockResolvedValue({ purged: 0 }) }));

const workspacesSnap = { docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> };
const tasksSnap = { docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> };

function chainable(result: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) {
  const query: Record<string, unknown> = {};
  query.where = vi.fn(() => query);
  query.orderBy = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.get = vi.fn().mockResolvedValue(result);
  return query;
}

vi.mock("./firestore/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./firestore/db")>();
  return {
    db: vi.fn(() => ({})),
    // Mirror the real getDocs: map raw snapshots to plain documents.
    getDocs: vi.fn(async (query: { get: () => Promise<typeof workspacesSnap> }) =>
      (await query.get()).docs.map((d) => actual.toPlainDoc(d.id, d.data())),
    ),
    workspacesCol: vi.fn(() => chainable(workspacesSnap)),
    tasksCol: vi.fn(() => chainable(tasksSnap)),
    usersCol: vi.fn(() => chainable({ docs: [] })),
    toDate: actual.toDate,
    toDateOrNull: actual.toDateOrNull,
    toPlainDoc: actual.toPlainDoc,
  };
});

const { runReminderSweep, runDigestSweep, runPurgeSweep } = await import("./scheduledJobs");

const workspace = {
  id: "ws1",
  name: "Workspace",
  ownerId: "owner-1",
  members: [
    { userId: "u1", email: "u1@foundationu.com", name: "U One", role: "member" },
    { userId: "u2", email: "u2@foundationu.com", name: "U Two", role: "member" },
  ],
};

const overdueAt = Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));
const dueNowAt = Timestamp.fromDate(new Date());

beforeEach(() => {
  vi.clearAllMocks();
  getNotificationsForUser.mockResolvedValue([]);
  workspacesSnap.docs = [{ id: "ws1", data: () => workspace }];
  tasksSnap.docs = [
    { id: "t1", data: () => ({ id: "t1", title: "Overdue task", assigneeIds: ["u1"], dueAt: overdueAt, completedAt: null, deletedAt: null }) },
    { id: "t2", data: () => ({ id: "t2", title: "Due today", assigneeIds: ["u1", "u2"], dueAt: dueNowAt, completedAt: null, deletedAt: null }) },
  ];
});

describe("runReminderSweep", () => {
  it("skips reminders that already exist unread and creates the rest", async () => {
    getNotificationsForUser.mockImplementation(async (userId: string) =>
      userId === "u1" ? [{ taskId: "t1", type: "overdue", readAt: null }] : [],
    );

    const result = await runReminderSweep();

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(1);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", type: "due_today", taskId: "t2", workspaceId: "ws1" }));
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "u2", type: "due_today", taskId: "t2" }));
    expect(createNotification).not.toHaveBeenCalledWith(expect.objectContaining({ taskId: "t1" }));
  });

  it("reads each distinct assignee's notifications once per sweep (no per-task N+1)", async () => {
    await runReminderSweep();

    // t1→u1, t2→u1, t2→u2: the naive loop would read u1's notifications twice.
    expect(getNotificationsForUser).toHaveBeenCalledTimes(2);
    expect(getNotificationsForUser).toHaveBeenCalledWith("u1");
    expect(getNotificationsForUser).toHaveBeenCalledWith("u2");
  });

  it("treats due-today and overdue tasks differently", async () => {
    await runReminderSweep();

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", type: "overdue", taskId: "t1" }));
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "due_today", taskId: "t2" }));
  });
});

describe("runDigestSweep", () => {
  it("sends one digest per member with due/overdue assignments", async () => {
    process.env.DIGEST_APP_ORIGIN = "https://tasknest-api.vercel.app";

    const result = await runDigestSweep();

    expect(result.sent).toBe(2);
    expect(sendDailyDigestEmail).toHaveBeenCalledTimes(2);
    expect(sendDailyDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "u1@foundationu.com",
        userName: "U One",
        appOrigin: "https://tasknest-api.vercel.app",
      }),
    );
    const firstCall = sendDailyDigestEmail.mock.calls[0][0];
    expect(firstCall.overdue).toHaveLength(1);
    expect(firstCall.overdue[0].title).toBe("Overdue task");
    expect(firstCall.dueToday).toHaveLength(1);
  });

  it("skips members who opted out of email digests", async () => {
    getUserByUid.mockResolvedValue({ preferences: { emailDigest: false } });

    const result = await runDigestSweep();

    expect(result.sent).toBe(0);
    expect(sendDailyDigestEmail).not.toHaveBeenCalled();
  });

  it("skips members without an email address", async () => {
    workspacesSnap.docs = [
      { id: "ws1", data: () => ({ ...workspace, members: [{ userId: "u3", email: "", name: "No Email", role: "member" }] }) },
    ];

    const result = await runDigestSweep();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(sendDailyDigestEmail).not.toHaveBeenCalled();
  });
});

describe("runPurgeSweep", () => {
  it("delegates to the trash purge", async () => {
    const result = await runPurgeSweep();
    expect(result).toEqual({ purged: 0 });
  });
});
