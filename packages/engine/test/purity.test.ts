// The engine must stay a pure function of its input: no I/O, no clock, no randomness, no Claude.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const files = readdirSync(SRC).filter((f) => f.endsWith(".ts"));

describe("engine purity", () => {
  it.each(files)("%s imports only other engine files", (f) => {
    const src = readFileSync(join(SRC, f), "utf8");
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports.filter((p) => !p?.startsWith("./"))).toEqual([]);
  });
  it.each(files)("%s uses no clock, randomness, network or storage", (f) => {
    const src = readFileSync(join(SRC, f), "utf8");
    for (const banned of [/Date\.now/, /new Date\(\s*\)/, /Math\.random/, /\bfetch\(/, /localStorage/, /indexedDB/, /process\.env/, /anthropic/i]) {
      expect(src).not.toMatch(banned);
    }
  });
});
