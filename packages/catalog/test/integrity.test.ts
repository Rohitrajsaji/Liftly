// Consistency checks on the reference data, including the 2026-10-08 program decisions (DECISIONS.md P1 to P4).
import { describe, expect, it } from "vitest";
import { EXERCISES, exercise, isPrescribable, loadDefinition, nextSlotKey, PROGRAMS, slot, swapFor } from "../src";

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

  it("P1: every exercise in the library has a class and equipment", () => {
    expect(Object.values(EXERCISES).filter((e) => !isPrescribable(e.id)).map((e) => e.id)).toEqual([]);
  });
  it("P2: no swap repeats an exercise already in the same workout", () => {
    const dupes = rows.filter((r) => slot(r.program, r.slot).exercises.some((e) => e.exerciseId === r.swapId));
    expect(dupes).toEqual([]);
  });
  it("P3: 45-Degree Back Extension is bodyweight and records added load (0 kg = bodyweight)", () => {
    expect(Object.values(EXERCISES).filter((e) => e.equipment === "bodyweight").map((e) => e.id)).toEqual(["back_extension_45"]);
    expect(loadDefinition("back_extension_45")).toBe("added_load");
  });
  it("P4: Assisted Pull-up is gone; Machine Pulldown is the Lat Pulldown swap in both programs", () => {
    expect(Object.keys(EXERCISES)).not.toContain("assisted_pull_up");
    expect(swapFor("3-day", "lat_pulldown")).toBe("machine_pulldown");
    expect(swapFor("4-day", "lat_pulldown")).toBe("machine_pulldown");
    expect(exercise("machine_pulldown")).toMatchObject({ type: "compound", equipment: "machine" });
  });
  it("load definitions follow DATA_MODEL: dumbbell per hand, machine and cable as displayed", () => {
    expect(loadDefinition("goblet_squat")).toBe("per_hand");
    expect(loadDefinition("leg_press")).toBe("displayed");
    expect(loadDefinition("lat_pulldown")).toBe("displayed");
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
    expect(swapFor("4-day", "seated_cable_row")).toBe("one_arm_dumbbell_row");
    expect(swapFor("4-day", "leg_extension")).toBe("goblet_squat");
  });
});
