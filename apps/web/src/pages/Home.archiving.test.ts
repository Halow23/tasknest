import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("project archiving", () => {
  it("exposes guarded archive/unarchive procedures and returns archived projects", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("archive: protectedProcedure.input");
    expect(source).toContain("unarchive: protectedProcedure.input");
    expect(source).toContain("set({ archived: true })");
    expect(source).toContain("set({ archived: false })");
    expect(source).toContain("archivedProjects");
    expect(source).toContain('eq(projects.archived, true)');
  });

  it("renders the sidebar Archive action and Restore list", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(home).toContain("trpc.tasknest.project.archive.useMutation");
    expect(home).toContain("trpc.tasknest.project.unarchive.useMutation");
    expect(home).toContain('aria-label="Archived projects"');
    expect(home).toContain("Restore");
    expect(home).toContain("archiveProject.mutate({ projectId: project.id })");
  });
});
