// PROGRESSION_ENGINE.md section 13. Ladder 6..20 kg (dumbbells, per hand).
import { describe, expect, it } from "vitest";
import { decideNext, nextRampStep, prescribe } from "../src";
import { DUMBBELL_LADDER, input, kg, sets } from "./helpers";

const db = (over: Parameters<typeof input>[0]) => input({ ladderG: DUMBBELL_LADDER, ...over });

describe("PROGRESSION_ENGINE.md section 13: worked examples", () => {
  it("Example A: bench W 16, 12,12,12 Good, day 30 -> 18 kg, target 8, ADVANCE, jump, first exposure", () => {
    expect(decideNext(db({ sets: sets([12, 12, 12]), daysSinceFirstSession: 30 }))).toMatchObject({
      nextG: kg(18), nextTargetReps: 8, reasonCode: "ADVANCE", jump: true, nextIsFirstExposure: true,
    });
  });
  it("Example B: lateral raise W 8, 15,15,15 Easy, day 10 -> 12 kg, target 10, FAST_UP, jump", () => {
    expect(decideNext(db({ exerciseType: "isolation", workingWeightG: kg(8), sets: sets([15, 15, 15], "easy"), daysSinceFirstSession: 10 }))).toMatchObject({
      nextG: kg(12), nextTargetReps: 10, reasonCode: "FAST_UP", jump: true,
    });
  });
  it("Example C: bench W 16, 9,8,7 -> hold 16, target 8, HOLD_PUSH", () => {
    expect(decideNext(db({ sets: sets([9, 8, 7]) }))).toMatchObject({ nextG: kg(16), nextTargetReps: 8, reasonCode: "HOLD_PUSH" });
  });
  it("Example D: bench W 16, 9,7,7 -> 14 kg, target 8, DELOAD_MISS", () => {
    expect(decideNext(db({ sets: sets([9, 7, 7]) }))).toMatchObject({ nextG: kg(14), nextTargetReps: 8, reasonCode: "DELOAD_MISS" });
  });
  it("Example E: last session 10 days ago, W 16 -> 14 kg, GAP_5", () => {
    expect(prescribe({ exerciseType: "compound", ladderG: DUMBBELL_LADDER, lastWorkingWeightG: kg(16), stored: { weightG: kg(16), targetReps: 9, firstExposure: false, reasonCode: "HOLD_PUSH" }, daysSinceLastSession: 10 }))
      .toMatchObject({ weightG: kg(14), reasonCode: "GAP_5" });
  });
  it("Example F: ramp 6 Easy, 8 Easy, 10 Good -> 10 kg is working set 1", () => {
    const r = nextRampStep({ exerciseType: "compound", ladderG: DUMBBELL_LADDER, startG: kg(6), recalibration: false, rampSets: [
      { weightG: kg(6), reps: 8, effort: "easy" }, { weightG: kg(8), reps: 8, effort: "easy" }, { weightG: kg(10), reps: 8, effort: "good" },
    ] });
    expect(r).toMatchObject({ kind: "done", workingWeightG: kg(10), lastRampSetIsWorkingSet1: true, firstExposure: true });
  });
  it("Example G: ramp 6, 8, 10 Easy, 12 Hard -> working weight 10 kg", () => {
    const r = nextRampStep({ exerciseType: "compound", ladderG: DUMBBELL_LADDER, startG: kg(6), recalibration: false, rampSets: [
      { weightG: kg(6), reps: 8, effort: "easy" }, { weightG: kg(8), reps: 8, effort: "easy" }, { weightG: kg(10), reps: 8, effort: "easy" }, { weightG: kg(12), reps: 8, effort: "hard" },
    ] });
    expect(r).toMatchObject({ kind: "done", workingWeightG: kg(10) });
  });
});
