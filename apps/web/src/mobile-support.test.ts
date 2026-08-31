import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("TaskNest mobile layout contract", () => {
  it("keeps workspace navigation available below the desktop breakpoint", () => {
    expect(stylesheet).toContain("@media (max-width: 1023px)");
    expect(stylesheet).toContain("display: flex !important;");
    expect(stylesheet).toContain("-webkit-overflow-scrolling: touch;");
  });

  it("provides swipeable, snap-aligned Kanban lanes on mobile", () => {
    expect(stylesheet).toContain("scroll-snap-type: x proximity;");
    expect(stylesheet).toContain("scroll-snap-align: start;");
    expect(stylesheet).toContain("flex: 0 0 min(82vw, 22rem);");
  });

  it("preserves the white workspace banner and unfiltered wave-field artwork", () => {
    const bannerRule = stylesheet.match(/#root main > div > section > div\.relative\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";
    const waveRule = stylesheet.match(/#root main > div > section > div\.relative::after\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";

    expect(bannerRule).toContain("background-color: #ffffff !important;");
    expect(waveRule).toContain("tasknest-wave-field_1dfe5e9b.png");
    expect(waveRule).toContain("opacity: 1;");
    expect(waveRule).not.toContain("filter:");
    expect(waveRule).not.toContain("tasknest-collaboration-orbit");
  });
});
