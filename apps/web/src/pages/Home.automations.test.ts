import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("automations", () => {
  it("exposes guarded rule CRUD with member/value validation", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const schema = await readFile(new URL("../../../api/drizzle/schema.ts", import.meta.url), "utf8");

    expect(source).toContain("automation: router({");
    expect(source).toContain("Automations can only reference workspace members.");
    expect(source).toContain("Choose a valid priority or status for this action.");
    expect(source).toContain("setEnabled: protectedProcedure.input(z.object({ ruleId: z.number().int().positive(), enabled: z.boolean() }))");
    expect(schema).toContain("export const automationRules = mysqlTable(");
  });

  it("evaluates rules inside logActivity with a no-cascade guard", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("async function runAutomationsForEvent(");
    expect(source).toContain('if (input.actorId === -1 || input.metadata?.source === "automation") return;');
    expect(source).toContain("eq(automationRules.enabled, true)");
    expect(source).toContain("void runAutomationsForEvent({ workspaceId: input.workspaceId, type: input.type, actorId: input.actorId, taskId: input.taskId ?? null, metadata: input.metadata });");
    expect(source).toContain("type: \"automation\", recipientIds: [userId]");
  });

  it("manages rules from a workspace dialog launched off the Team-context card", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const dialog = await readFile(new URL("../components/AutomationSettingsDialog.tsx", import.meta.url), "utf8");

    expect(home).toContain('aria-label="Open workspace automation settings"');
    expect(home).toContain("<AutomationSettingsDialog open={automationOpen}");
    expect(dialog).toContain("trpc.tasknest.automation.list.useQuery");
    expect(dialog).toContain("trpc.tasknest.automation.create.useMutation({");
    expect(dialog).toContain('When {triggerLabels[rule.trigger]} → {actionLabels[rule.action]}');
  });
});
