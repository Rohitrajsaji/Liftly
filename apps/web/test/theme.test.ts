// The warm orange theme must keep strong contrast (UX §11): WCAG AA is 4.5:1 for normal text.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "src", "styles.css"), "utf8");
const token = (name: string): string => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m?.[1]) throw new Error(`No colour token ${name}`);
  return m[1];
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe("theme contrast", () => {
  const pairs: [string, string][] = [
    ["ink", "bg"],
    ["ink", "surface"],
    ["muted", "bg"],
    ["muted", "surface"],
    ["accent-ink", "accent"],
    ["ink", "accent-soft"],
    ["accent", "bg"],
    ["accent", "accent-soft"],
    ["warn-ink", "warn-soft"],
  ];
  for (const [fg, bg] of pairs) {
    it(`${fg} on ${bg} is at least 4.5:1`, () => {
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("is a light theme with no dark-mode override", () => {
    // Soft grey (neumorphic, Rohit 2026-10-08) is still a light background.
    expect(luminance(token("bg"))).toBeGreaterThan(0.75);
    expect(luminance(token("ink"))).toBeLessThan(0.05);
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/);
  });

  it("has no green left in the tokens", () => {
    for (const name of ["accent", "accent-soft"]) {
      const hex = token(name);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
      expect(r).toBeGreaterThan(g);
      expect(r).toBeGreaterThan(b);
    }
  });
});
