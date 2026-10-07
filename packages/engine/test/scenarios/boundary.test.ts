// TESTING.md section 2: boundary tests.
import { describe, expect, it } from "vitest";
import { decideNext } from "../../src";
import { DUMBBELL_LADDER, input, kg, sets } from "../helpers";

describe("TESTING.md section 2: boundaries", () => {
  it("B-01 [OPEN default: inclusive]: day 21, all Easy, lowest 12 -> row 3", () => {
    const d = decideNext(input({ sets: sets([12, 12, 12], "easy"), daysSinceFirstSession: 21 }));
    expect(d?.ruleRow).toBe(3);
    expect(d?.reasonCode).toBe("FAST_UP");
  });
  it("B-02: day 22, all Easy, lowest 12 -> row 4, +1 step", () => {
    const d = decideNext(input({ sets: sets([12, 12, 12], "easy"), daysSinceFirstSession: 22 }));
    expect(d?.ruleRow).toBe(4);
    expect(d?.nextG).toBe(kg(18));
  });
  it("B-03: lowest exactly 12 (= T), all Easy, day 40 -> row 4, +1 step", () => {
    const d = decideNext(input({ sets: sets([12, 13, 12], "easy") }));
    expect(d?.ruleRow).toBe(4);
    expect(d?.nextG).toBe(kg(18));
  });
  it("B-04: lowest exactly 8 (= B), no misses -> row 6, target 9", () => {
    const d = decideNext(input({ sets: sets([8, 9, 10]) }));
    expect(d?.ruleRow).toBe(6);
    expect(d?.nextTargetReps).toBe(9);
  });
  it("B-05: lowest exactly 7, no Failed tap -> one miss, row 6, target 8", () => {
    const d = decideNext(input({ sets: sets([9, 8, 7]) }));
    expect(d?.misses).toBe(1);
    expect(d?.ruleRow).toBe(6);
    expect(d?.nextTargetReps).toBe(8);
  });
  it("B-06: isolation, lowest 10 (= B), day 40 -> row 6, target 11", () => {
    const d = decideNext(input({ exerciseType: "isolation", ladderG: DUMBBELL_LADDER, workingWeightG: kg(8), sets: sets([10, 11, 12]) }));
    expect(d?.ruleRow).toBe(6);
    expect(d?.nextTargetReps).toBe(11);
  });
  it("B-07: isolation, lowest 15 (= T), all Easy, day 40 -> row 4, +1 step, target 10", () => {
    const d = decideNext(input({ exerciseType: "isolation", ladderG: DUMBBELL_LADDER, workingWeightG: kg(8), sets: sets([15, 15, 15], "easy") }));
    expect(d?.ruleRow).toBe(4);
    expect(d?.nextG).toBe(kg(10));
    expect(d?.nextTargetReps).toBe(10);
  });
});
