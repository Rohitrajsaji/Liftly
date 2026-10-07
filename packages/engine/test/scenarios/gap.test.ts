// TESTING.md section 6: break and comeback. Compound ladder 6..22 kg, last W 16.
import { describe, expect, it } from "vitest";
import { prescribe, type Prescription } from "../../src";
import { COMPOUND_LADDER, kg } from "../helpers";

function after(days: number, lastKg = 16): Prescription {
  return prescribe({
    exerciseType: "compound",
    ladderG: COMPOUND_LADDER,
    lastWorkingWeightG: kg(lastKg),
    stored: { weightG: kg(lastKg), targetReps: 9, firstExposure: false, reasonCode: "HOLD_PUSH" },
    daysSinceLastSession: days,
  });
}

function working(p: Prescription) {
  if (p.kind !== "working") throw new Error("expected a working prescription");
  return p;
}

describe("TESTING.md section 6: gap", () => {
  it("G-01: 7 days -> no adjustment, prescribe 16", () => {
    const p = working(after(7));
    expect(p.weightG).toBe(kg(16));
    expect(p.gapAdjustment).toBe("none");
    expect(p.reasonCode).toBe("HOLD_PUSH");
  });
  it("G-02: 8 days -> GAP_5, highest step <= 15.2 -> 14 kg", () => {
    const p = working(after(8));
    expect(p.weightG).toBe(kg(14));
    expect(p.reasonCode).toBe("GAP_5");
    expect(p.targetReps).toBe(8); // default: B
  });
  it("G-03: 14 days -> GAP_5, 14 kg", () => {
    expect(working(after(14))).toMatchObject({ weightG: kg(14), reasonCode: "GAP_5" });
  });
  it("G-04: 15 days -> GAP_10, highest step <= 14.4 -> 14 kg", () => {
    expect(working(after(15))).toMatchObject({ weightG: kg(14), reasonCode: "GAP_10" });
  });
  it("G-05: 28 days -> GAP_10, 14 kg", () => {
    expect(working(after(28))).toMatchObject({ weightG: kg(14), reasonCode: "GAP_10" });
  });
  it("G-06: 29 days -> RECAL, ramp from 8 kg or below", () => {
    const p = after(29);
    expect(p.kind).toBe("calibration");
    if (p.kind === "calibration") {
      expect(p.reasonCode).toBe("RECAL");
      expect(p.rampStartG).toBeLessThanOrEqual(kg(8));
    }
  });
  it("G-07: 10 days, on a pain swap with swap W 14 -> gap rule applies to the swap's weight", () => {
    // The caller passes the swap exercise's own W; 0.95 x 14 = 13.3 -> 12 kg.
    expect(working(after(10, 14))).toMatchObject({ weightG: kg(12), reasonCode: "GAP_5" });
  });
  it("G-08 [ASSUMPTION default]: 10 days, W at the bottom of the ladder (6 kg) -> keep 6 kg", () => {
    const p = working(after(10, 6));
    expect(p.weightG).toBe(kg(6));
    expect(p.ladderEdge).toBe(true);
  });
  it("C5: a gap cut is not a first exposure and carries the gap code", () => {
    const p = prescribe({
      exerciseType: "compound",
      ladderG: COMPOUND_LADDER,
      lastWorkingWeightG: kg(16),
      stored: { weightG: kg(18), targetReps: 8, firstExposure: true, reasonCode: "ADVANCE" },
      daysSinceLastSession: 10,
    });
    expect(working(p)).toMatchObject({ weightG: kg(14), reasonCode: "GAP_5", firstExposure: false });
  });
});
