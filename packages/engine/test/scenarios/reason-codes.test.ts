// TESTING.md section 9: reason codes.
import { describe, expect, it } from "vitest";
import { decideNext, nextRampStep, prescribe, REASON_CODES } from "../../src";
import { COMPOUND_LADDER, input, kg, sets } from "../helpers";

describe("TESTING.md section 9: reason codes", () => {
  it("R-01 (C5): every target has exactly one reason code from the v1.0 list", () => {
    const samples = [
      decideNext(input({ sets: sets([12, 12, 12]) })),
      decideNext(input({ sets: sets([9, 7, 7]) })),
      decideNext(input({ sets: sets([10, 10, 10]), painReported: true })),
    ];
    for (const d of samples) expect(REASON_CODES).toContain(d?.reasonCode);
    const gap = prescribe({
      exerciseType: "compound",
      ladderG: COMPOUND_LADDER,
      lastWorkingWeightG: kg(16),
      stored: { weightG: kg(18), targetReps: 8, firstExposure: true, reasonCode: "ADVANCE" },
      daysSinceLastSession: 20,
    });
    expect(gap.reasonCode).toBe("GAP_10");
  });
  it("R-02 (C5): a first-time calibration has decision type calibration and no reason code", () => {
    const d = nextRampStep({ exerciseType: "compound", ladderG: COMPOUND_LADDER, startG: kg(6), rampSets: [{ weightG: kg(6), reps: 8, effort: "good" }], recalibration: false });
    expect(d).toMatchObject({ kind: "done", decisionType: "calibration", reasonCode: null });
  });
  it("R-03: the debrief cites only engine codes -> tested in packages/coach (milestone M9)", () => {
    // Engine side: the code list the debrief validator checks against is exported and complete.
    expect(REASON_CODES).toHaveLength(9);
  });
  it("R-04: JUMP and first exposure are flags, not codes", () => {
    const d = decideNext(input({ sets: sets([12, 12, 12]) }));
    expect(d?.jump).toBe(true);
    expect(d?.nextIsFirstExposure).toBe(true);
    expect(REASON_CODES).not.toContain("JUMP");
    expect(REASON_CODES).not.toContain("FIRST_EXPOSURE");
  });
});
