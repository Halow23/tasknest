import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("presigned uploads", () => {
  it("exposes guarded presign and register procedures with a 50 MB cap", async () => {
    const source = await readFile(new URL("../../../server/routers/tasknest.ts", import.meta.url), "utf8");
    const storage = await readFile(new URL("../../../server/storage.ts", import.meta.url), "utf8");

    expect(source).toContain("presign: protectedProcedure.input(z.object({ taskId:");
    expect(source).toContain("register: protectedProcedure.input(z.object({ taskId:");
    expect(source).toContain("byteSize: z.number().int().min(1).max(50 * 1024 * 1024)");
    expect(source).toContain("storagePresignPutUrl(`tasknest/${result.project.workspaceId}/tasks/${input.taskId}/${safeFileName}`)");
    expect(source).toContain("`/manus-storage/${input.storageKey}`");
    expect(storage).toContain("export async function storagePresignPutUrl(");
  });

  it("keeps the legacy base64 upload as fallback", async () => {
    const source = await readFile(new URL("../../../server/routers/tasknest.ts", import.meta.url), "utf8");
    expect(source).toContain("upload: protectedProcedure.input(z.object({ taskId:");
    expect(source).toContain("Attachments must be smaller than 5 MB.");
  });

  it("uploads browser-direct with server-relayed fallback in the drawer", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(drawer).toContain("trpc.tasknest.attachment.presign.useMutation()");
    expect(drawer).toContain("trpc.tasknest.attachment.register.useMutation({");
    expect(drawer).toContain('method: "PUT", headers: { "Content-Type": contentType }, body: file');
    expect(drawer).toContain("Direct upload unavailable — sending through the server instead.");
    expect(drawer).toContain("const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;");
  });
});
