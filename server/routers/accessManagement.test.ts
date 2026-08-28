import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getManagedAccessRules = vi.fn();
const addAllowedDomain = vi.fn();
const listDeniedSignInEvents = vi.fn();

vi.mock("../db", () => ({
  getManagedAccessRules,
  addAllowedDomain,
  addAllowedExternalEmail: vi.fn(),
  listDeniedSignInEvents,
  removeAllowedDomain: vi.fn(),
  removeAllowedExternalEmail: vi.fn(),
}));

const { accessManagementRouter } = await import("./accessManagement");

const adminUser = {
  id: 1,
  openId: "admin-user",
  name: "Admin User",
  email: "admin@foundationu.com",
  loginMethod: "manus",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(role: "admin" | "user" = "admin"): TrpcContext {
  return {
    user: { ...adminUser, role },
    accessDenied: false,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("access management router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getManagedAccessRules.mockResolvedValue({
      domains: [{ id: 1, domain: "foundationu.com" }],
      emails: [{ id: 2, email: "advisor@external.org", note: "Program advisor" }],
    });
  });

  it("allows an administrator to add a normalized approved domain", async () => {
    addAllowedDomain.mockResolvedValue({ id: 3, domain: "partner.edu" });
    const caller = accessManagementRouter.createCaller(createContext());

    await expect(caller.addDomain({ domain: "  PARTNER.EDU " })).resolves.toMatchObject({ domain: "partner.edu" });
    expect(addAllowedDomain).toHaveBeenCalledWith({ domain: "partner.edu", createdById: 1 });
  });

  it("prevents non-administrators from retrieving access policy settings", async () => {
    const caller = accessManagementRouter.createCaller(createContext("user"));

    await expect(caller.settings()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns the latest denied sign-in events to administrators", async () => {
    listDeniedSignInEvents.mockResolvedValue([{ id: 9, attemptedEmail: "guest@gmail.com", reason: "email_not_approved" }]);
    const caller = accessManagementRouter.createCaller(createContext());

    await expect(caller.deniedSignIns({ limit: 25 })).resolves.toHaveLength(1);
    expect(listDeniedSignInEvents).toHaveBeenCalledWith(25);
  });
});
