import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AdminSettings.tsx"), "utf8");

describe("AdminSettings", () => {
  it("provides managed domains, named email exceptions, and a denied-sign-in audit view", () => {
    expect(source).toContain("Approved email domains");
    expect(source).toContain("External collaborator allowlist");
    expect(source).toContain("Denied sign-in audit");
    expect(source).toContain("trpc.accessManagement.addDomain");
    expect(source).toContain("trpc.accessManagement.addExternalEmail");
    expect(source).toContain("trpc.accessManagement.deniedSignIns");
  });
});
