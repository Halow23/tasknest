import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Regression test for the Firestore Timestamp leak.
 *
 * `getDocs`/`getDoc`/`toPlainDoc` must hand the application layer real Dates.
 * A raw Timestamp serialises over tRPC as `{_seconds, _nanoseconds}`, which
 * `new Date()` cannot parse: it yields Invalid Date and Intl.DateTimeFormat
 * throws "RangeError: Invalid time value", crashing the page.
 *
 * This has already caused three production crashes — the admin denied-sign-in
 * audit, the My Tasks view, and the workspace invite dialog — each time because
 * a call site returned raw `doc.data()`. These tests pin the conversion so the
 * helpers cannot regress.
 */
describe("firestore document conversion", () => {
  it("converts a Timestamp to a Date", async () => {
    const { toPlainDoc } = await import("./db");
    const when = new Date("2026-09-23T00:00:00Z");
    const doc = toPlainDoc<{ createdAt: unknown }>("id-1", { createdAt: Timestamp.fromDate(when) });

    expect(doc.createdAt).toBeInstanceOf(Date);
    expect((doc.createdAt as Date).toISOString()).toBe(when.toISOString());
    expect(() => new Intl.DateTimeFormat(undefined, { month: "short" }).format(doc.createdAt as Date)).not.toThrow();
  });

  it("leaves null in place and preserves the id", async () => {
    const { toPlainDoc } = await import("./db");
    const doc = toPlainDoc<{ expiresAt: unknown; name: string }>("doc-9", { expiresAt: null, name: "Alpha" });

    expect(doc.id).toBe("doc-9");
    expect(doc.expiresAt).toBeNull();
    expect(doc.name).toBe("Alpha");
  });

  it("converts nested and array Timestamps, as embedded subtasks need", async () => {
    const { toPlainDoc } = await import("./db");
    const when = new Date("2026-09-23T00:00:00Z");
    const doc = toPlainDoc<{ subtasks: { createdAt: unknown }[]; meta: { updatedAt: unknown } }>("id-2", {
      subtasks: [{ createdAt: Timestamp.fromDate(when) }],
      meta: { updatedAt: Timestamp.fromDate(when) },
    });

    expect(doc.subtasks[0].createdAt).toBeInstanceOf(Date);
    expect(doc.meta.updatedAt).toBeInstanceOf(Date);
  });

  it("passes through non-Timestamp values untouched", async () => {
    const { toPlainDoc } = await import("./db");
    const doc = toPlainDoc<Record<string, unknown>>("id-3", {
      title: "Task",
      count: 3,
      done: false,
      tags: ["a", "b"],
    });

    expect(doc.title).toBe("Task");
    expect(doc.count).toBe(3);
    expect(doc.done).toBe(false);
    expect(doc.tags).toEqual(["a", "b"]);
  });

  it("getDocs and getDoc share the same conversion", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./db.ts", import.meta.url), "utf8"),
    );

    // Both helpers must route through the converter, never raw doc.data().
    expect(src).toContain("return toPlainDocs<T>(snap);");
    expect(src).toContain("...(convertTimestamps(snap.data()) as object)");
    expect(src).not.toContain("...doc.data() } as T & { id: string }");
    expect(src).not.toContain("...snap.data() } as T & { id: string }");
  });
});
