import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("project archiving", () => {
  it("exposes guarded archive/unarchive procedures and returns archived projects", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("archive: protectedProcedure");
    expect(source).toContain("unarchive: protectedProcedure");
    expect(source).toContain(".update({ archived: true })");
    expect(source).toContain(".update({ archived: false })");
    expect(source).toContain("archivedProjects");
    expect(source).toContain("allProjects.filter((p) => p.archived)");
  });

  it("renders the sidebar Archive action and Restore list", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(home).toContain("trpc.tasknest.project.archive.useMutation");
    expect(home).toContain("trpc.tasknest.project.unarchive.useMutation");
    expect(home).toContain('aria-label="Archived projects"');
    expect(home).toContain("Restore");
    expect(home).toContain("archiveProject.mutate({ projectId: project.id, workspaceId: workspace.id })");
  });
});
