// TESTING.md section 5: stall. W 16 kg. "Last 3 exposures" include the current session as the newest.
// Interpretation [OPEN, default]: compare current total with the first of the last three.
import { describe, expect, it } from "vitest";
import { decideNext } from "../../src";
import { exposures, input, kg, setsWithTotal } from "../helpers";

function stallCase(totals: [number, number, number], lowest: number, currentGap = 2) {
  const [a, b, c] = totals;
  return decideNext(input({ sets: setsWithTotal(c, lowest), priorExposures: exposures(16, [a, b]), daysSinceLastSession: currentGap }));
}

describe("TESTING.md section 5: stall", () => {
  it("S-01 [OPEN default]: 31, 30, 31, current 31, lowest 9 -> stall, row 5, 14 kg, target 8, STALL_DELOAD", () => {
    const d = stallCase([31, 30, 31], 9);
    expect(d?.ruleRow).toBe(5);
    expect(d?.nextG).toBe(kg(14));
    expect(d?.nextTargetReps).toBe(8);
    expect(d?.reasonCode).toBe("STALL_DELOAD");
  });
  it("S-02 [OPEN default]: 30, 31, 32, current 32, lowest 9 -> not a stall, row 6, hold 16, target 10", () => {
    const d = stallCase([30, 31, 32], 9);
    expect(d?.ruleRow).toBe(6);
    expect(d?.nextG).toBe(kg(16));
    expect(d?.nextTargetReps).toBe(10);
    expect(d?.reasonCode).toBe("HOLD_PUSH");
  });
  it("S-03 [OPEN default]: 30, 31, 31, current 31, lowest 9 -> not a stall (31 > 30), row 6", () => {
    const d = stallCase([30, 31, 31], 9);
    expect(d?.ruleRow).toBe(6);
    expect(d?.reasonCode).toBe("HOLD_PUSH");
  });
  it("S-04 [OPEN default]: 31, 30, 30, current 30, lowest 10 -> stall (30 <= 31), row 5, 14 kg", () => {
    const d = stallCase([31, 30, 30], 10);
    expect(d?.ruleRow).toBe(5);
    expect(d?.nextG).toBe(kg(14));
    expect(d?.reasonCode).toBe("STALL_DELOAD");
  });
  it("S-05: weight changed in the last session -> counter reset, no stall", () => {
    const prior = [...exposures(14, [31]), ...exposures(16, [30])];
    const d = decideNext(input({ sets: setsWithTotal(30, 9), priorExposures: prior }));
    expect(d?.stallCounter).toBe(2);
    expect(d?.ruleRow).toBe(6);
  });
  it("S-06: break of 20 days before the current session -> counter reset, no stall", () => {
    const d = stallCase([31, 30, 31], 9, 20);
    expect(d?.stallCounter).toBe(1);
    expect(d?.ruleRow).toBe(6);
  });
});
