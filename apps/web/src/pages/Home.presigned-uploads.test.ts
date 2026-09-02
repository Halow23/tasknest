import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("presigned uploads", () => {
  it("exposes guarded presign and register procedures with a 50 MB cap", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const storage = await readFile(new URL("../../../api/src/storage.ts", import.meta.url), "utf8");

    expect(source).toContain("presign: protectedProcedure");
    expect(source).toContain("register: protectedProcedure");
    expect(source).toContain("byteSize: z.number().int().min(1).max(50 * 1024 * 1024)");
    expect(source).toContain("storagePresignPutUrl(`tasknest/${input.workspaceId}/tasks/${input.taskId}/${safeFileName}`, input.contentType)");
    expect(storage).toContain("export async function storagePresignPutUrl(");
    expect(storage).toContain("storagePresignPutUrl");
  });

  it("keeps the legacy base64 upload as fallback", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    expect(source).toContain("upload: protectedProcedure");
    expect(source).toContain("Attachments must be smaller than 5 MB.");
  });

  it("uploads browser-direct with server-relayed fallback in the drawer", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(drawer).toContain("trpc.tasknest.attachment.presign.useMutation()");
    expect(drawer).toContain("trpc.tasknest.attachment.register.useMutation({");
    expect(drawer).toContain('method: "POST", body: formData');
    expect(drawer).toContain("Direct upload unavailable — sending through the server instead.");
    expect(drawer).toContain("const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;");
  });

  it("relays through the server without an error toast when signing is unavailable", async () => {
    const storage = await readFile(new URL("../../../api/src/storage.ts", import.meta.url), "utf8");
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    // Presign returns a signed Cloudinary upload endpoint; the drawer falls
    // back to the server relay whenever the direct browser upload fails.
    expect(storage).toContain("uploadParams: Record<string, string | number>;");
    expect(drawer).toContain("if (!presigned.uploadUrl || !presigned.uploadParams) { relayThroughServer(); return; }");
    expect(drawer).toContain("toast.info(\"Direct upload unavailable — sending through the server instead.\");");
  });
});
