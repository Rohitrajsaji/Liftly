// Consistency checks on the reference data, and the known gaps listed in PROGRAMS_QUESTIONS.md.
import { describe, expect, it } from "vitest";
import { EXERCISES, isPrescribable, nextSlotKey, PROGRAMS, slot, swapFor } from "../src";

const programs = Object.values(PROGRAMS);
const rows = programs.flatMap((p) => p.slots.flatMap((s) => s.exercises.map((r) => ({ program: p.id, slot: s.key, ...r }))));

describe("catalog integrity", () => {
  it("the library holds exactly the program exercises and their swaps", () => {
    const used = new Set(rows.flatMap((r) => [r.exerciseId, r.swapId]));
    expect(new Set(Object.keys(EXERCISES))).toEqual(used);
  });
  it("every program exercise has a known type and equipment", () => {
    expect(rows.filter((r) => !isPrescribable(r.exerciseId))).toEqual([]);
  });
  it("within one program, each exercise always has the same swap", () => {
    for (const p of programs) {
      const seen = new Map<string, string>();
      for (const s of p.slots) for (const r of s.exercises) {
        expect(seen.get(r.exerciseId) ?? r.swapId).toBe(r.swapId);
        seen.set(r.exerciseId, r.swapId);
      }
    }
  });
  it("orders run 1..n in every slot", () => {
    for (const p of programs) for (const s of p.slots) expect(s.exercises.map((e) => e.order)).toEqual(s.exercises.map((_, i) => i + 1));
  });

  // Known gaps, asserted so they stay visible until Rohit closes them (PROGRAMS_QUESTIONS.md).
  it("PQ1: swap-only exercises without a stated type or equipment", () => {
    const missing = Object.values(EXERCISES).filter((e) => e.type === null).map((e) => e.id).sort();
    expect(missing).toEqual([
      "assisted_pull_up", "cable_bicep_curl", "cable_crossover", "cable_crunch", "incline_machine_press",
      "leg_press_calf_raise", "lying_leg_curl", "machine_glute_kickback", "machine_shoulder_press", "overhead_triceps_extension",
    ]);
  });
  it("PQ2: swaps that are already in the same workout", () => {
    const dupes = rows.filter((r) => slot(r.program, r.slot).exercises.some((e) => e.exerciseId === r.swapId)).map((r) => `${r.slot}:${r.exerciseId}->${r.swapId}`);
    expect(dupes.sort()).toEqual(["L1:leg_extension->leg_press", "U2:seated_cable_row->chest_supported_row"]);
  });
  it("PQ3: bodyweight exercises have no load ladder for the engine to move along", () => {
    expect(Object.values(EXERCISES).filter((e) => e.equipment === "bodyweight").map((e) => e.id)).toEqual(["back_extension_45"]);
  });
});

describe("sequence (US-18)", () => {
  it("3-day runs A -> B -> C -> A regardless of weekday", () => {
    expect(nextSlotKey("3-day", null)).toBe("A");
    expect(nextSlotKey("3-day", "A")).toBe("B");
    expect(nextSlotKey("3-day", "B")).toBe("C");
    expect(nextSlotKey("3-day", "C")).toBe("A");
  });
  it("4-day runs U1 -> L1 -> U2 -> L2 -> U1", () => {
    expect(nextSlotKey("4-day", null)).toBe("U1");
    expect(nextSlotKey("4-day", "U1")).toBe("L1");
    expect(nextSlotKey("4-day", "L1")).toBe("U2");
    expect(nextSlotKey("4-day", "U2")).toBe("L2");
    expect(nextSlotKey("4-day", "L2")).toBe("U1");
  });
  it("a slot from the other program is rejected", () => {
    expect(() => nextSlotKey("3-day", "U1")).toThrow();
  });
  it("swapFor returns the program's approved swap", () => {
    expect(swapFor("3-day", "machine_chest_press")).toBe("dumbbell_bench_press");
    expect(swapFor("3-day", "chest_supported_row")).toBe("seated_cable_row");
    expect(swapFor("4-day", "chest_supported_row")).toBe("lat_pulldown");
  });
});
