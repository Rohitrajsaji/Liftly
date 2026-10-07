// TESTING.md section 3: calibration (ramp). Compound, ladder 6..22 kg.
import { describe, expect, it } from "vitest";
import { nextRampStep, prescribe, recalibrationStart, type RampSet, type RampStep } from "../../src";
import { COMPOUND_LADDER, kg } from "../helpers";

const ramp = (...steps: [number, "easy" | "good" | "hard" | "failed"][]): RampSet[] =>
  steps.map(([w, effort]) => ({ weightG: kg(w), reps: 8, effort }));

function run(rampSets: RampSet[], recalibration = false): RampStep {
  return nextRampStep({ exerciseType: "compound", ladderG: COMPOUND_LADDER, startG: kg(6), rampSets, recalibration });
}

function done(step: RampStep) {
  if (step.kind !== "done") throw new Error(`expected the ramp to be done, got ${JSON.stringify(step)}`);
  return step;
}

describe("TESTING.md section 3: calibration", () => {
  it("C-01: 6 Easy, 8 Easy, 10 Good -> working weight 10; the 10 kg set is working set 1", () => {
    const d = done(run(ramp([6, "easy"], [8, "easy"], [10, "good"])));
    expect(d.workingWeightG).toBe(kg(10));
    expect(d.lastRampSetIsWorkingSet1).toBe(true);
  });
  it("C-01 (steps): each Easy moves up one ladder step", () => {
    expect(run([])).toEqual({ kind: "ramp", weightG: kg(6), targetReps: 8 });
    expect(run(ramp([6, "easy"]))).toEqual({ kind: "ramp", weightG: kg(8), targetReps: 8 });
    expect(run(ramp([6, "easy"], [8, "easy"]))).toEqual({ kind: "ramp", weightG: kg(10), targetReps: 8 });
  });
  it("C-02: 6 Easy, 8 Easy, 10 Easy, 12 Hard -> working weight 10 (previous step); ramp stops", () => {
    const d = done(run(ramp([6, "easy"], [8, "easy"], [10, "easy"], [12, "hard"])));
    expect(d.workingWeightG).toBe(kg(10));
    expect(d.lastRampSetIsWorkingSet1).toBe(false);
  });
  it("C-03: 6 Easy, 8 Easy, 10 Easy, 12 Failed -> working weight 10", () => {
    expect(done(run(ramp([6, "easy"], [8, "easy"], [10, "easy"], [12, "failed"]))).workingWeightG).toBe(kg(10));
  });
  it("C-04: 6, 8, 10, 12, 14 all Easy (5 ramp sets) -> working weight 14", () => {
    const d = done(run(ramp([6, "easy"], [8, "easy"], [10, "easy"], [12, "easy"], [14, "easy"])));
    expect(d.workingWeightG).toBe(kg(14));
    expect(d.lastRampSetIsWorkingSet1).toBe(false); // default, DECISIONS.md section 2
  });
  it("C-05: 6 Good at the first set -> working weight 6; ramp stops immediately", () => {
    const d = done(run(ramp([6, "good"])));
    expect(d.workingWeightG).toBe(kg(6));
    expect(d.lastRampSetIsWorkingSet1).toBe(true);
  });
  it("C-06: ramp sets are logged as ramp and not counted in volume", () => {
    // Ramp sets have their own type (RampSet) and never enter DecisionInput.sets; only a Good ramp set
    // is promoted, and the app logs it as working set 1.
    const d = done(run(ramp([6, "easy"], [8, "good"])));
    expect(d.lastRampSetIsWorkingSet1).toBe(true);
    const notPromoted = done(run(ramp([6, "easy"], [8, "hard"])));
    expect(notPromoted.lastRampSetIsWorkingSet1).toBe(false);
  });
  it("C-07: return after 35 days, last W 20 -> ramp starts at or below 10 kg, recalibration, RECAL", () => {
    const p = prescribe({
      exerciseType: "compound",
      ladderG: COMPOUND_LADDER,
      lastWorkingWeightG: kg(20),
      stored: { weightG: kg(20), targetReps: 9, firstExposure: false, reasonCode: "HOLD_PUSH" },
      daysSinceLastSession: 35,
    });
    expect(p.kind).toBe("calibration");
    if (p.kind !== "calibration") return;
    expect(p.rampStartG).toBeLessThanOrEqual(kg(10));
    expect(p.rampStartG).toBe(recalibrationStart(COMPOUND_LADDER, kg(20)).weightG);
    expect(p.decisionType).toBe("recalibration");
    expect(p.reasonCode).toBe("RECAL");
    const d = done(run(ramp([10, "good"]), true));
    expect(d.decisionType).toBe("recalibration");
    expect(d.reasonCode).toBe("RECAL");
  });
  it("C-08 (C1): calibration session -> decision type calibration, first exposure, miss floor B - 2", () => {
    const d = done(run(ramp([6, "easy"], [8, "good"])));
    expect(d.decisionType).toBe("calibration");
    expect(d.reasonCode).toBeNull(); // R-02 / C5
    expect(d.firstExposure).toBe(true);
    expect(d.missThreshold).toBe(6);
  });
});
