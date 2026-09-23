import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getManagedAccessRules = vi.fn();
const addAllowedDomain = vi.fn();

vi.mock("../firestore/access", () => ({
  getManagedAccessRules,
  addAllowedDomain,
  addAllowedEmail: vi.fn(),
  getTaskNestEmailAccess: vi.fn(),
  removeAllowedDomain: vi.fn(),
  removeAllowedEmail: vi.fn(),
  recordDeniedSignIn: vi.fn(),
}));

// Denied sign-in events/alerts are read straight from Firestore — stub the
// query layer (chainable orderBy/limit) so no real Firebase project is needed.
const getDocsMock = vi.fn().mockResolvedValue([]);
const chainableQuery = () => {
  const q: Record<string, unknown> = {};
  q.orderBy = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  return q;
};
vi.mock("../firestore/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../firestore/db")>();
  return {
    db: vi.fn(() => ({})),
    deniedSignInAlertsCol: vi.fn(() => chainableQuery()),
    deniedSignInEventsCol: vi.fn(() => chainableQuery()),
    getDocs: getDocsMock,
    // Real implementations: these are pure and need no Firebase connection.
    toDate: actual.toDate,
    toDateOrNull: actual.toDateOrNull,
  };
});

const { accessManagementRouter } = await import("./accessManagement");

const adminUser = {
  id: "admin-user-1",
  openId: "admin-user",
  name: "Admin User",
  email: "admin@foundationu.com",
  loginMethod: "firebase",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(role: "admin" | "user" = "admin"): TrpcContext {
  return {
    user: { ...adminUser, role },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("access management router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getManagedAccessRules.mockResolvedValue({
      domains: [{ id: "rule-1", domain: "foundationu.com" }],
      emails: [{ id: "rule-2", email: "advisor@external.org", note: "Program advisor", expiresAt: null }],
    });
  });

  it("allows an administrator to add a normalized approved domain", async () => {
    addAllowedDomain.mockResolvedValue({ id: "rule-3", domain: "partner.edu" });
    const caller = accessManagementRouter.createCaller(createContext());

    await expect(caller.addDomain({ domain: "  PARTNER.EDU " })).resolves.toMatchObject({ domain: "partner.edu" });
    expect(addAllowedDomain).toHaveBeenCalledWith({ domain: "partner.edu", createdById: "admin-user-1" });
  });

  it("prevents non-administrators from retrieving access policy settings", async () => {
    const caller = accessManagementRouter.createCaller(createContext("user"));

    await expect(caller.settings()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns the latest denied sign-in events to administrators", async () => {
    getDocsMock.mockResolvedValue([{ id: "9", attemptedEmail: "guest@gmail.com", reason: "email_not_approved" }]);
    const caller = accessManagementRouter.createCaller(createContext());

    await expect(caller.deniedSignIns({ limit: 25, search: "gmail" })).resolves.toHaveLength(1);
  });

  it("provides a filtered, CSV-ready audit export to administrators only", async () => {
    getDocsMock.mockResolvedValue([{ id: "12", attemptedEmail: "guest@example.org", emailDomain: "example.org" }]);
    const caller = accessManagementRouter.createCaller(createContext());

    await expect(caller.exportDeniedSignIns({ search: "example.org" })).resolves.toHaveLength(1);
  });

  // Firestore hands back Timestamps, not Dates. The admin UI calls new Date()
  // on these, which yields "Invalid Date" and crashes Intl.DateTimeFormat with
  // "Invalid time value" — so the router must convert them.
  it("returns denied sign-in timestamps as real Dates, not Firestore Timestamps", async () => {
    const firestoreTimestamp = { _seconds: 1790114880, _nanoseconds: 185000000 };
    getDocsMock.mockResolvedValue([
      { id: "9", attemptedEmail: "guest@gmail.com", reason: "email_not_approved", createdAt: firestoreTimestamp },
    ]);
    const caller = accessManagementRouter.createCaller(createContext());

    const [event] = await caller.deniedSignIns({ limit: 25 });
    expect(event.createdAt).toBeInstanceOf(Date);
    expect(Number.isNaN(new Date(event.createdAt as unknown as string).getTime())).toBe(false);
    expect(() =>
      new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(event.createdAt as unknown as string),
      ),
    ).not.toThrow();
  });

  it("returns alert timestamps as real Dates", async () => {
    const firestoreTimestamp = { _seconds: 1790114880, _nanoseconds: 0 };
    getDocsMock.mockResolvedValue([
      { id: "gmail.com", emailDomain: "gmail.com", count: 3, lastDeniedAt: firestoreTimestamp, windowStartedAt: firestoreTimestamp, createdAt: firestoreTimestamp, updatedAt: firestoreTimestamp, lastNotifiedAt: null },
    ]);
    const caller = accessManagementRouter.createCaller(createContext());

    const [alert] = await caller.deniedSignInAlerts({ limit: 20 });
    expect(alert.lastDeniedAt).toBeInstanceOf(Date);
    expect(alert.lastNotifiedAt).toBeNull();
    expect(() =>
      new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(alert.lastDeniedAt as unknown as string),
      ),
    ).not.toThrow();
  });
});
