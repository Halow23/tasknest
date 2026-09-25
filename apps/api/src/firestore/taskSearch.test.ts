import { describe, expect, it } from "vitest";
import { buildSearchTokens } from "./task";

describe("buildSearchTokens", () => {
  it("lowercases, splits on punctuation, and removes duplicates", () => {
    expect(buildSearchTokens("Fix Login-Bug", "also review the Login flow")).toEqual([
      "fix",
      "login",
      "bug",
      "also",
      "review",
      "the",
      "flow",
    ]);
  });

  it("drops single-character words and empty fragments", () => {
    expect(buildSearchTokens("a big UI v2 app", null)).toEqual(["big", "ui", "v2", "app"]);
  });

  it("caps the token list at 120 entries", () => {
    const description = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    const tokens = buildSearchTokens("title", description);
    expect(tokens).toHaveLength(120);
  });

  it("returns tokens from the title alone when there is no description", () => {
    expect(buildSearchTokens("Ship the release", null)).toEqual(["ship", "the", "release"]);
  });
});
