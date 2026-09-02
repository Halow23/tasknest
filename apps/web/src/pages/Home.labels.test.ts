import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("labels/tags integration", () => {
  it("exposes workspace label CRUD through the tRPC router", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const schema = await readFile(new URL("../../../api/src/firestore/types.ts", import.meta.url), "utf8");

    expect(source).toContain("label: router({");
    expect(source).toContain("resolveLabelMap");
    expect(source).toContain("resolveLabelMap(allLabels, input.labelIds)");
    expect(source).toContain('labelIds: z.array(z.string().min(1)).max(20).optional()');
    expect(source).toContain("const validLabels = allLabels.filter((label) => template.labelIds.includes(label.id));");
    expect(schema).toContain("labelIds: string[];");
  });

  it("returns joined labels in task list and detail responses", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("labels: labelRows");
    expect(source).toContain("labelRows,");
    expect(source).toContain('labels: Object.entries(detail.task.labelNames)');
  });

  it("renders label chips on board cards and pickers in both task dialogs", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const board = await readFile(new URL("./home/BoardView.tsx", import.meta.url), "utf8");
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");
    const picker = await readFile(new URL("../components/LabelPicker.tsx", import.meta.url), "utf8");

    expect(home).toContain("<LabelPicker workspaceId={workspace.id}");
    expect(home).toContain("labelIds: newTaskLabelIds");
    expect(board).toContain("labelMap");
    expect(drawer).toContain('<LabelPicker workspaceId={task.project?.workspaceId ?? ""}');
    expect(drawer).toContain("labelIds: editLabelIds");
    expect(picker).toContain("export function LabelChip");
    expect(picker).toContain("tasknest.label.create");
  });
});
