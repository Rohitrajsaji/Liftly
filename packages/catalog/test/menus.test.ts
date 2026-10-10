// Checks the slot menus against PROGRAMS.md section 3b and against the fixed programs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXERCISES, exercise, MENUS, menuFor, PROGRAMS } from "../src";

const MD = readFileSync(join(__dirname, "..", "..", "..", "PROGRAMS.md"), "utf8");
const idOf = (name: string): string => {
  const e = Object.values(EXERCISES).find((x) => x.name === name);
  if (e === undefined) throw new Error(`PROGRAMS.md 3b names an unknown exercise: ${name}`);
  return e.id;
};

/** Rows of the 3b table under "### <heading>": slot label, then the menu with the "(locked)" note removed. */
function menuRows(heading: string): Map<string, string[]> {
  const start = MD.indexOf(`\n### ${heading}\n`);
  if (start === -1) throw new Error(`PROGRAMS.md 3b has no "${heading}" table`);
  const rest = MD.slice(start + heading.length + 6);
  const end = rest.search(/\n#{1,3} |\n---\n|\nRules the app/);
  const body = end === -1 ? rest : rest.slice(0, end);
  const out = new Map<string, string[]>();
  for (const l of body.split("\n").filter((x) => /^\| [A-Z]\d/.test(x))) {
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    out.set(c[0] ?? "", (c[2] ?? "").replace(/ \(locked\)$/, "").split(", ").map(idOf));
  }
  return out;
}

describe("slot menus match PROGRAMS.md 3b", () => {
  for (const [programId, heading] of [["3-day", "3-day"], ["4-day", "4-day"]] as const) {
    const md = menuRows(heading);
    const label = (key: string, order: number) => (programId === "3-day" ? `${key}${order}` : `${key}-${order}`);
    it(`${programId}: one menu per slot row, same options in the same order`, () => {
      const ours = new Map(MENUS[programId].map((x) => [label(x.slotKey, x.order), [...x.options] as string[]]));
      expect(ours).toEqual(md);
    });
    for (const slot of PROGRAMS[programId].slots) {
      for (const row of slot.exercises) {
        it(`${programId} ${slot.key}${row.order}: fixed exercise first, one class, no repeats`, () => {
          const menu = menuFor(programId, slot.key, row.order);
          expect(menu.at(0)).toBe(row.exerciseId);
          expect(new Set(menu).size).toBe(menu.length);
          for (const id of menu) expect(exercise(id).type).toBe(exercise(row.exerciseId).type);
        });
      }
    }
  }
});
