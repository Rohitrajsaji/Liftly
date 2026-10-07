// Invariants over thousands of random sessions (fast-check).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decideNext, highestAtOrBelow, prescribe, REASON_CODES, type DecisionInput, type Effort } from "../src";

const effort = fc.constantFrom<Effort>("easy", "good", "hard", "failed");
const ladder = fc.uniqueArray(fc.integer({ min: 1, max: 400 }).map((n) => n * 500), { minLength: 1, maxLength: 30 });

const decisionInput: fc.Arbitrary<DecisionInput> = ladder.chain((l) =>
  fc.record({
    exerciseType: fc.constantFrom("compound" as const, "isolation" as const),
    ladderG: fc.constant(l),
    workingWeightG: fc.constantFrom(...l),
    sets: fc.array(fc.record({ reps: fc.integer({ min: 0, max: 25 }), effort }), { minLength: 1, maxLength: 5 }),
    firstExposure: fc.boolean(),
    painReported: fc.boolean(),
    daysSinceFirstSession: fc.integer({ min: 0, max: 400 }),
    daysSinceLastSession: fc.integer({ min: 0, max: 60 }),
    priorExposures: fc.array(
      fc.record({ weightG: fc.constantFrom(...l), totalReps: fc.integer({ min: 0, max: 60 }), daysSinceLastSession: fc.integer({ min: 0, max: 30 }) }),
      { maxLength: 6 },
    ),
  }),
);

const RUNS = { numRuns: 5000 };

describe("engine invariants", () => {
  it("the next weight is always a step on the ladder", () => {
    fc.assert(fc.property(decisionInput, (i) => i.ladderG.includes(decideNext(i)?.nextG ?? -1)), RUNS);
  });
  it("pain never raises the weight", () => {
    fc.assert(fc.property(decisionInput, (i) => {
      const d = decideNext({ ...i, painReported: true });
      return d !== null && d.nextG <= i.workingWeightG && d.reasonCode === "PAIN_SWAP";
    }), RUNS);
  });
  it("every decision has exactly one row and a reason code from the v1.0 list", () => {
    fc.assert(fc.property(decisionInput, (i) => {
      const d = decideNext(i);
      return d !== null && [1, 2, 3, 4, 5, 6].includes(d.ruleRow) && REASON_CODES.includes(d.reasonCode);
    }), RUNS);
  });
  it("the same input always gives the same output", () => {
    fc.assert(fc.property(decisionInput, (i) => {
      const a = decideNext(i);
      const b = decideNext(structuredClone(i));
      expect({ ...a, input: null }).toEqual({ ...b, input: null });
    }), { numRuns: 1000 });
  });
  it("only rows 3 and 4 raise the weight, and only rows 2 and 5 lower it", () => {
    fc.assert(fc.property(decisionInput, (i) => {
      const d = decideNext(i);
      if (d === null) return false;
      if (d.nextG > d.previousG) return d.ruleRow === 3 || d.ruleRow === 4;
      if (d.nextG < d.previousG) return d.ruleRow === 2 || d.ruleRow === 5;
      return true;
    }), RUNS);
  });
  it("the next target is always within the rep range", () => {
    fc.assert(fc.property(decisionInput, (i) => {
      const d = decideNext(i);
      const [b, t] = i.exerciseType === "compound" ? [8, 12] : [10, 15];
      return d !== null && d.nextTargetReps >= b && d.nextTargetReps <= t;
    }), RUNS);
  });
  it("a deload or gap cut lands at or below the factor, unless the ladder has no step that low", () => {
    fc.assert(fc.property(ladder, fc.constantFrom(900, 950, 500), (l, f) => {
      const w = Math.max(...l);
      const r = highestAtOrBelow(l, w, f);
      return r.ladderEdge || r.weightG * 1000 <= w * f;
    }), RUNS);
  });
  it("a gap prescription never raises the weight above the last working weight", () => {
    fc.assert(fc.property(ladder, fc.integer({ min: 8, max: 28 }), (l, days) => {
      const w = l.at(-1) ?? 1;
      const p = prescribe({ exerciseType: "compound", ladderG: l, lastWorkingWeightG: w, stored: { weightG: w, targetReps: 8, firstExposure: false, reasonCode: "HOLD_PUSH" }, daysSinceLastSession: days });
      return p.kind === "working" && p.weightG <= w && l.includes(p.weightG);
    }), RUNS);
  });
});
