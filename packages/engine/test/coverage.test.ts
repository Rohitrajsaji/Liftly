// Fails if any engine scenario ID in TESTING.md has no matching test, so the spec and the tests can't drift.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const ENGINE_PREFIXES = ["D", "B", "C", "W", "S", "G", "P", "L", "R"];
/** Scenario groups that belong to later milestones, not the engine. */
const LATER = { A: "M9 debrief validator (packages/coach)", O: "M5 offline sync (apps/web e2e)", T: "plan tailoring (packages/workout)" };

function testingIds(): string[] {
  const md = readFileSync(join(ROOT, "TESTING.md"), "utf8");
  return [...md.matchAll(/^\| ([A-Z])-(\d\d) \|/gm)].map((m) => `${m[1]}-${m[2]}`);
}

function testSources(): string {
  const dir = join(__dirname, "scenarios");
  return readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
}

describe("TESTING.md coverage", () => {
  const ids = testingIds();
  it("finds the scenario tables", () => {
    expect(ids.length).toBeGreaterThan(70);
  });
  it("every engine scenario has a test named by its ID", () => {
    const src = testSources();
    const missing = ids.filter((id) => ENGINE_PREFIXES.includes(id[0] ?? "")).filter((id) => !src.includes(`"${id}`));
    expect(missing).toEqual([]);
  });
  it("every other scenario group is assigned to a later milestone", () => {
    const other = [...new Set(ids.map((id) => id[0] ?? "").filter((p) => !ENGINE_PREFIXES.includes(p)))];
    expect(other.sort()).toEqual(Object.keys(LATER).sort());
  });
});
