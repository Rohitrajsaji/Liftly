// TESTING.md section 4: weight increase, hold, and deload. Compound unless stated.
import { describe, expect, it } from "vitest";
import { checkSetDuringSession, decideNext } from "../../src";
import { DUMBBELL_LADDER, input, kg, sets } from "../helpers";

describe("TESTING.md section 4: increase, hold, deload", () => {
  it("W-01: ADVANCE 16 -> 18 (+12.5%) sets JUMP; next session is a first exposure with floor 6", () => {
    const d = decideNext(input({ sets: sets([12, 12, 12]) }));
    expect(d?.nextG).toBe(kg(18));
    expect(d?.jump).toBe(true);
    expect(d?.nextIsFirstExposure).toBe(true);
    const next = decideNext(input({ workingWeightG: kg(18), firstExposure: true, sets: sets([8, 8, 8]) }));
    expect(next?.missThresholdUsed).toBe(6);
  });
  it("W-02: ADVANCE 8 -> 10 (+25%) sets JUMP; floor 6 (compound)", () => {
    const d = decideNext(input({ workingWeightG: kg(8), sets: sets([12, 12, 12]) }));
    expect(d?.nextG).toBe(kg(10));
    expect(d?.jump).toBe(true);
    const next = decideNext(input({ workingWeightG: kg(10), firstExposure: true, sets: sets([8, 8, 8]) }));
    expect(next?.missThresholdUsed).toBe(6);
  });
  it("W-03: isolation lateral raise 8 -> 10 (+25%) sets JUMP; floor 8 (isolation B - 2)", () => {
    const d = decideNext(input({ exerciseType: "isolation", ladderG: DUMBBELL_LADDER, workingWeightG: kg(8), sets: sets([15, 15, 15]) }));
    expect(d?.nextG).toBe(kg(10));
    expect(d?.jump).toBe(true);
    const next = decideNext(input({ exerciseType: "isolation", ladderG: DUMBBELL_LADDER, workingWeightG: kg(10), firstExposure: true, sets: sets([10, 10, 10]) }));
    expect(next?.missThresholdUsed).toBe(8);
  });
  it("W-04: first exposure after jump at 18: 6,7,6 -> 0 misses, row 6, target 8, hold 18", () => {
    const d = decideNext(input({ workingWeightG: kg(18), firstExposure: true, sets: sets([6, 7, 6]) }));
    expect(d?.misses).toBe(0);
    expect(d?.ruleRow).toBe(6);
    expect(d?.nextTargetReps).toBe(8);
    expect(d?.nextG).toBe(kg(18));
  });
  it("W-05: first exposure after jump at 18: 5,5,6 -> two misses, row 2, 16 kg, target 8", () => {
    const d = decideNext(input({ workingWeightG: kg(18), firstExposure: true, sets: sets([5, 5, 6]) }));
    expect(d?.misses).toBe(2);
    expect(d?.ruleRow).toBe(2);
    expect(d?.nextG).toBe(kg(16));
    expect(d?.nextTargetReps).toBe(8);
  });
  it("W-06: hold after one miss: 9,8,7 (floor 8) -> one miss, row 6, hold, target 8", () => {
    const d = decideNext(input({ sets: sets([9, 8, 7]) }));
    expect(d?.misses).toBe(1);
    expect(d?.ruleRow).toBe(6);
    expect(d?.nextG).toBe(kg(16));
    expect(d?.nextTargetReps).toBe(8);
  });
  it("W-07: deload 9,7,7 at W 16 -> two misses, row 2, highest step <= 14.4 -> 14", () => {
    const d = decideNext(input({ sets: sets([9, 7, 7]) }));
    expect(d?.ruleRow).toBe(2);
    expect(d?.nextG).toBe(kg(14));
  });
  it("W-08: set 2 at 5 reps mid-workout -> weight stays, may end the exercise, no new weight until next session", () => {
    expect(checkSetDuringSession(5)).toEqual({ weightChangeG: null, mayEndExercise: true });
    expect(checkSetDuringSession(6)).toEqual({ weightChangeG: null, mayEndExercise: false });
  });
});
