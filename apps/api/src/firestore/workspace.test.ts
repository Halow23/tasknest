import { beforeEach, describe, expect, it, vi } from "vitest";

const docMock = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
};

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    db: vi.fn(() => ({})),
    usersCol: vi.fn(() => ({ doc: vi.fn(() => docMock) })),
  };
});

import { upsertUser } from "./workspace";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertUser", () => {
  it("creates the user doc with the token name on first sign-in", async () => {
    docMock.get.mockResolvedValueOnce({ exists: false });

    await upsertUser({
      openId: "u1",
      name: "Rafael Udtohan",
      email: "rafael@foundationu.com",
      loginMethod: "google",
    });

    expect(docMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Rafael Udtohan",
        email: "rafael@foundationu.com",
        role: "user",
      }),
    );
  });

  it("does not overwrite the stored name on later sign-ins — profile edits survive", async () => {
    docMock.get.mockResolvedValueOnce({ exists: true });

    await upsertUser({
      openId: "u1",
      name: "Name From Token",
      email: "rafael@foundationu.com",
      loginMethod: "google",
    });

    const payload = docMock.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("name");
    expect(payload).toHaveProperty("lastSignedIn");
  });
});
