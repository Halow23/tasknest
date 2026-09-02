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
vi.mock("../firestore/db", () => ({
  db: vi.fn(() => ({})),
  deniedSignInAlertsCol: vi.fn(() => chainableQuery()),
  deniedSignInEventsCol: vi.fn(() => chainableQuery()),
  getDocs: getDocsMock,
}));

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
});
