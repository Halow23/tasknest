import { describe, expect, it } from "vitest";
import { isAllowedTaskNestEmail } from "./accessPolicy";

describe("Foundation University email access policy", () => {
  it("allows a verified @foundationu.com login email", () => {
    expect(isAllowedTaskNestEmail("student@foundationu.com")).toBe(true);
  });

  it("denies personal and lookalike email domains", () => {
    expect(isAllowedTaskNestEmail("student@gmail.com")).toBe(false);
    expect(isAllowedTaskNestEmail("student@foundationu.com.example")).toBe(false);
  });

  it("matches the approved email domain without regard to case or outer whitespace", () => {
    expect(isAllowedTaskNestEmail("  Student@FoundationU.COM ")).toBe(true);
  });

  it("denies a login when its email address is missing or malformed", () => {
    expect(isAllowedTaskNestEmail(null)).toBe(false);
    expect(isAllowedTaskNestEmail(undefined)).toBe(false);
    expect(isAllowedTaskNestEmail("foundationu.com")).toBe(false);
  });
});
