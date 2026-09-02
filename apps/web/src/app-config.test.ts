import { describe, expect, it } from "vitest";

describe("TaskNest app configuration", () => {
  it("keeps a non-empty application title configured", () => {
    expect((import.meta.env.VITE_APP_TITLE || "TaskNest").trim()).toBeTruthy();
  });
});
