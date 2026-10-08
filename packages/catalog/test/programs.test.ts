// Checks the catalog against PROGRAMS.md field by field (PROGRAMS.md section 9: these must match exactly).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REP_RANGES } from "@liftly/engine";
import { describe, expect, it } from "vitest";
import { EXERCISES, exercise, PROGRAMS, type ProgramId } from "../src";

const MD = readFileSync(join(__dirname, "..", "..", "..", "PROGRAMS.md"), "utf8");

interface MdRow { order: number; name: string; cls: string; equipment: string; sets: number; reps: string; swap: string }

/** Table rows under a "## <heading>" until the next heading. */
function tableUnder(heading: string): MdRow[] {
  const start = MD.indexOf(`\n## ${heading}\n`);
  if (start === -1) throw new Error(`PROGRAMS.md has no section "${heading}"`);
  const rest = MD.slice(start + heading.length + 4);
  const end = rest.search(/\n#{1,2} /);
  const body = end === -1 ? rest : rest.slice(0, end);
  return body
    .split("\n")
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => {
      const c = l.split("|").slice(1, -1).map((x) => x.trim());
      return { order: Number(c[0]), name: c[1] ?? "", cls: c[2] ?? "", equipment: c[3] ?? "", sets: Number(c[4]), reps: c[5] ?? "", swap: c[6] ?? "" };
    });
}

function sequenceLine(id: ProgramId): string[] {
  const m = MD.match(new RegExp(`- ${id}: \`([^\`]+)\``));
  if (!m?.[1]) throw new Error(`No sequence for ${id}`);
  return m[1].split("→").map((s) => s.trim()).filter((s) => s !== "...");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

describe("catalog matches PROGRAMS.md exactly", () => {
  for (const program of Object.values(PROGRAMS)) {
    it(`${program.id}: sequence`, () => {
      const seq = sequenceLine(program.id);
      // The line repeats the first slot to show the loop: A → B → C → A.
      expect(seq.slice(0, -1)).toEqual([...program.sequence]);
      expect(seq.at(-1)).toBe(program.sequence.at(0));
      expect(program.slots.map((s) => s.key)).toEqual([...program.sequence]);
    });
    for (const slot of program.slots) {
      it(`${program.id} ${slot.name}: order, name, class, equipment, sets, rep range, swap`, () => {
        const md = tableUnder(slot.name);
        const ours = slot.exercises.map((r) => {
          const e = exercise(r.exerciseId);
          const range = e.type === null ? null : REP_RANGES[e.type];
          return {
            order: r.order,
            name: e.name,
            cls: e.type === null ? "" : cap(e.type),
            equipment: e.equipment === null ? "" : cap(e.equipment),
            sets: r.sets,
            reps: range === null ? "" : `${range.bottom}–${range.top}`,
            swap: exercise(r.swapId).name,
          };
        });
        expect(ours).toEqual(md);
      });
    }
  }

  it("swap-only exercises: class, equipment and rep range match section 3a", () => {
    const start = MD.indexOf("\n# 3a. Swap Exercise Reference");
    const body = MD.slice(start, MD.indexOf("\n# 4.", start));
    const md = body
      .split("\n")
      .filter((l) => l.startsWith("| ") && !l.startsWith("| Exercise") && !l.startsWith("|---"))
      .map((l) => l.split("|").slice(1, -1).map((x) => x.trim()));
    const programIds = new Set(Object.values(PROGRAMS).flatMap((p) => p.slots.flatMap((s) => s.exercises.map((e) => e.exerciseId))));
    const swapOnly = Object.values(EXERCISES).filter((e) => !programIds.has(e.id));
    const ours = swapOnly.map((e) => {
      const range = e.type === null ? null : REP_RANGES[e.type];
      return [e.name, e.type === null ? "" : cap(e.type), e.equipment === null ? "" : cap(e.equipment), range === null ? "" : `${range.bottom}–${range.top}`];
    });
    expect(ours.sort()).toEqual(md.sort());
  });
});
