// TESTING.md section 8: large equipment increments.
import { describe, expect, it } from "vitest";
import { decideNext, stepsUp } from "../../src";
import { DUMBBELL_LADDER, input, kg, kgs, sets } from "../helpers";

const iso = (over: Parameters<typeof input>[0]) => input({ exerciseType: "isolation", ladderG: DUMBBELL_LADDER, ...over });

describe("TESTING.md section 8: large increments", () => {
  it("L-01: DB bench 16 -> 18 jump; first exposure floor 6; 7,6,6 -> no misses, row 6, target 8", () => {
    const d = decideNext(input({ ladderG: DUMBBELL_LADDER, workingWeightG: kg(18), firstExposure: true, sets: sets([7, 6, 6]) }));
    expect(d?.misses).toBe(0);
    expect(d?.ruleRow).toBe(6);
    expect(d?.nextTargetReps).toBe(8);
  });
  it("L-02: DB bench 8 -> 10 jump; floor 6; 6,6,5 -> one miss, row 6, target 8", () => {
    const d = decideNext(input({ ladderG: DUMBBELL_LADDER, workingWeightG: kg(10), firstExposure: true, sets: sets([6, 6, 5]) }));
    expect(d?.misses).toBe(1);
    expect(d?.ruleRow).toBe(6);
    expect(d?.nextTargetReps).toBe(8);
  });
  it("L-03 (Q1): DB bench 8 -> 10, sets 5,5,5 -> three misses, row 2, highest step <= 9.0 -> 8 kg, target 8", () => {
    const d = decideNext(input({ ladderG: DUMBBELL_LADDER, workingWeightG: kg(10), firstExposure: true, sets: sets([5, 5, 5]) }));
    expect(d?.misses).toBe(3);
    expect(d?.ruleRow).toBe(2);
    expect(d?.nextG).toBe(kg(8));
    expect(d?.nextTargetReps).toBe(8);
  });
  it("L-04: lateral raise 8 -> 10, floor 8; 9,8,8 -> no misses, row 6, target 10", () => {
    const d = decideNext(iso({ workingWeightG: kg(10), firstExposure: true, sets: sets([9, 8, 8]) }));
    expect(d?.misses).toBe(0);
    expect(d?.ruleRow).toBe(6);
    expect(d?.nextTargetReps).toBe(10);
  });
  it("L-05 (Q1): lateral raise 8 -> 10, 9,7,7 -> two misses below floor 8, row 2, highest step <= 9.0 -> 8 kg", () => {
    const d = decideNext(iso({ workingWeightG: kg(10), firstExposure: true, sets: sets([9, 7, 7]) }));
    expect(d?.misses).toBe(2);
    expect(d?.ruleRow).toBe(2);
    expect(d?.nextG).toBe(kg(8));
  });
  it("L-06: machine with 5 kg steps, 40 -> 45 (+12.5%) -> jump; 45 kg taken; floor 6", () => {
    const machine = kgs(30, 35, 40, 45, 50, 55);
    const d = decideNext(input({ ladderG: machine, workingWeightG: kg(40), sets: sets([12, 12, 12]) }));
    expect(d?.nextG).toBe(kg(45));
    expect(d?.jump).toBe(true);
    expect(d?.nextIsFirstExposure).toBe(true);
    expect(decideNext(input({ ladderG: machine, workingWeightG: kg(45), firstExposure: true, sets: sets([6, 6, 6]) }))?.missThresholdUsed).toBe(6);
  });
  it("L-07: ladder missing an intermediate step -> next available step only, never off-ladder", () => {
    const gappy = kgs(6, 8, 12, 14);
    const d = decideNext(input({ ladderG: gappy, workingWeightG: kg(8), sets: sets([12, 12, 12]) }));
    expect(d?.nextG).toBe(kg(12));
    expect(gappy).toContain(d?.nextG);
  });
  it("L-09 (Q1): deload from 10 kg on a 5, 7.5, 10 kg ladder -> highest step <= 9.0 -> 7.5 kg", () => {
    const d = decideNext(input({ ladderG: kgs(5, 7.5, 10), workingWeightG: kg(10), firstExposure: true, sets: sets([5, 5, 5]) }));
    expect(d?.ruleRow).toBe(2);
    expect(d?.nextG).toBe(kg(7.5));
    expect(d?.nextTargetReps).toBe(8);
  });
  it("L-08 [ASSUMPTION default]: requested step beyond the top of the ladder -> keep W, ladderEdge flag", () => {
    const d = decideNext(input({ ladderG: kgs(12, 14, 16), workingWeightG: kg(16), sets: sets([12, 12, 12]) }));
    expect(d?.nextG).toBe(kg(16));
    expect(d?.ladderEdge).toBe(true);
    expect(d?.nextIsFirstExposure).toBe(false);
    expect(d?.reasonCode).toBe("ADVANCE");
    // +2 steps with only one step left takes the top step.
    expect(stepsUp(kgs(12, 14, 16), kg(14), 2)).toEqual({ weightG: kg(16), ladderEdge: true });
  });
});

describe("bodyweight exercise with external load (PROGRAMS.md 1.1, DECISIONS.md P3)", () => {
  // 45-Degree Back Extension: 0 kg = bodyweight only, then the added loads the gym actually has.
  const backExt = kgs(0, 2.5, 5, 10, 15);
  const bw = (over: Parameters<typeof input>[0]) => input({ exerciseType: "isolation", ladderG: backExt, ...over });

  it("L-10: bodyweight only, 15,15,15 Good -> row 4, first added load (2.5 kg), target 10", () => {
    const d = decideNext(bw({ workingWeightG: 0, sets: sets([15, 15, 15]) }));
    expect(d).toMatchObject({ ruleRow: 4, nextG: kg(2.5), nextTargetReps: 10, jump: true, nextIsFirstExposure: true });
  });
  it("L-11: 2.5 kg added, two misses -> row 2, 0.90 x 2.5 = 2.25 -> back to bodyweight (0 kg)", () => {
    const d = decideNext(bw({ workingWeightG: kg(2.5), sets: sets([9, 8, 8]) }));
    expect(d).toMatchObject({ ruleRow: 2, nextG: 0, ladderEdge: false });
  });
  it("L-12: at bodyweight with two misses -> stays at bodyweight (bottom of the ladder)", () => {
    const d = decideNext(bw({ workingWeightG: 0, sets: sets([8, 8, 8]) }));
    expect(d).toMatchObject({ ruleRow: 2, nextG: 0 });
  });
  it("L-13: uneven gym steps are followed exactly (5 -> 10 kg), never a fixed increment", () => {
    const d = decideNext(bw({ workingWeightG: kg(5), sets: sets([15, 15, 15]) }));
    expect(d?.nextG).toBe(kg(10));
  });
});
