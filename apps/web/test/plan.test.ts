// PRD AC-1: 3-day yields A, B, C in order; 4-day yields U1, L1, U2, L2; exercises and set counts match the frozen spec.
import { exercise, PROGRAMS } from "@liftly/catalog";
import { describe, expect, it } from "vitest";
import { planPreview } from "../src/plan";

describe("plan preview (PRD F2, AC-1)", () => {
  it("3-day: Workout A, B, C in that order", () => {
    const p = planPreview("3-day");
    expect(p.workouts.map((w) => w.key)).toEqual(["A", "B", "C"]);
    expect(p.workouts.map((w) => w.name)).toEqual(["Workout A", "Workout B", "Workout C"]);
    expect(p.sessionsPerWeek).toBe(3);
  });

  it("4-day: Upper 1, Lower 1, Upper 2, Lower 2 in that order", () => {
    const p = planPreview("4-day");
    expect(p.workouts.map((w) => w.key)).toEqual(["U1", "L1", "U2", "L2"]);
    expect(p.workouts.map((w) => w.name)).toEqual(["Upper 1", "Lower 1", "Upper 2", "Lower 2"]);
    expect(p.sessionsPerWeek).toBe(4);
  });

  for (const program of Object.values(PROGRAMS)) {
    it(`${program.id}: every exercise, set count and rep range comes from the catalog unchanged`, () => {
      const p = planPreview(program.id);
      for (const w of p.workouts) {
        const slot = program.slots.find((s) => s.key === w.key);
        expect(slot).toBeDefined();
        expect(w.exercises.map((e) => [e.order, e.name, e.sets])).toEqual(slot?.exercises.map((r) => [r.order, exercise(r.exerciseId).name, r.sets]));
        for (const e of w.exercises) {
          const type = Object.values(slot?.exercises ?? []).map((r) => exercise(r.exerciseId)).find((x) => x.name === e.name)?.type;
          expect(e.reps).toBe(type === "compound" ? "8–12" : "10–15");
        }
        expect(w.totalSets).toBe(w.exercises.reduce((n, e) => n + e.sets, 0));
      }
    });
  }

  it("shows no weights: starting weights come from calibration", () => {
    const json = JSON.stringify(planPreview("4-day"));
    expect(json).not.toMatch(/\bkg\b|"\w*weight\w*":/i);
  });
});
