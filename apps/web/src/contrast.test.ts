import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Palette contrast guard.
 *
 * Light mode previously shipped a family of near-identical greys measuring
 * 1.8:1–3.9:1 against white, which made secondary text unreadable. These tests
 * pin the replacement tokens to WCAG AA so the palette cannot silently drift
 * back below threshold.
 */

const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

/* ── WCAG 2.1 relative luminance ─────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(c =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads `--name: #hex;` out of the stylesheet. */
function token(name: string): string {
  const match = stylesheet.match(
    new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`)
  );
  if (!match) throw new Error(`Token --${name} not found as a hex value`);
  return match[1];
}

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

describe("light palette contrast", () => {
  const white = "#FFFFFF";
  const laneSurface = "#F2F7FA";
  const pageSurface = "#F7FAFB";

  it("secondary text clears AA on every surface it is used on", () => {
    const secondary = token("tn-text-secondary");
    expect(contrast(secondary, white)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrast(secondary, laneSurface)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrast(secondary, pageSurface)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("primary body ink clears AAA", () => {
    // #172B4D is the long-standing body ink and is not part of the token set.
    expect(contrast("#172B4D", white)).toBeGreaterThanOrEqual(7);
    expect(contrast("#172B4D", pageSurface)).toBeGreaterThanOrEqual(7);
  });

  it("accent and status text clear AA", () => {
    expect(contrast(token("tn-accent-strong"), white)).toBeGreaterThanOrEqual(
      AA_NORMAL
    );
    expect(contrast(token("tn-danger"), token("tn-danger-soft"))).toBeGreaterThanOrEqual(
      AA_NORMAL
    );
    expect(contrast(token("tn-warn"), token("tn-warn-soft"))).toBeGreaterThanOrEqual(
      AA_NORMAL
    );
  });

  it("white text on the primary button gradient clears AA", () => {
    // The gradient's *bottom* stop is the darkest, so it is the worst case.
    expect(contrast(white, token("tn-accent-strong"))).toBeGreaterThanOrEqual(
      AA_NORMAL
    );
  });

  it("keeps the legacy failing greys out of the primary text roles", () => {
    // These are the values that motivated the readability pass. They must not
    // reappear as body/secondary text — only as fills, borders or decoration.
    const banned = [
      "#9BAAB3",
      "#8B9EAA",
      "#8A9BA6",
      "#90A1AB",
      "#91A3AE",
      "#8498A5",
      "#7F94A1",
    ];
    for (const hex of banned) {
      const usedAsText = new RegExp(`text-\\[${hex}\\]`, "i").test(stylesheet);
      if (usedAsText) {
        // If reintroduced as a utility it must be covered by the readability
        // remap layer, which forces it back to --tn-text-secondary.
        const covered = stylesheet.includes(`[class*="text-[${hex}]"]`);
        expect(covered).toBe(true);
      }
    }
  });
});

describe("dark palette contrast", () => {
  const surfaces = ["#121212", "#171717", "#262626"];

  it("secondary text clears AA on every dark surface", () => {
    // Dark mode previously mapped every secondary grey to oklch(0.93 0 0),
    // within 2% of the 0.95 primary — collapsing the hierarchy entirely.
    const darkSecondary = stylesheet.match(
      /\.dark\s*\{[^}]*--tn-text-secondary:\s*(#[0-9A-Fa-f]{6})/s
    )?.[1];
    expect(darkSecondary).toBeTruthy();
    for (const surface of surfaces) {
      expect(contrast(darkSecondary!, surface)).toBeGreaterThanOrEqual(
        AA_NORMAL
      );
    }
  });

  it("secondary is perceptibly darker than primary so hierarchy survives", () => {
    const darkSecondary = stylesheet.match(
      /\.dark\s*\{[^}]*--tn-text-secondary:\s*(#[0-9A-Fa-f]{6})/s
    )?.[1];
    const primary = "#F2F2F2"; // oklch(0.95 0 0)
    expect(contrast(primary, "#121212")).toBeGreaterThan(
      contrast(darkSecondary!, "#121212") * 1.5
    );
  });

  it("keeps the too-light grey remap out of the dark layer", () => {
    // oklch(0.93 0 0) was the value that flattened dark-mode hierarchy.
    expect(stylesheet).not.toMatch(
      /\.dark \[class\*="text-\[#9BAAB3\]"\][^{]*\{\s*color:\s*oklch\(0\.93/
    );
  });
});
