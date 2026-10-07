// TESTING.md section 1: decision table. Compound, B 8, T 12, ladder 6..22 kg.
import { describe, expect, it } from "vitest";
import { decideNext } from "../../src";
import { input, kg, sets } from "../helpers";

function expectDecision(d: ReturnType<typeof decideNext>, row: number, nextKg: number, target: number, code: string) {
  expect(d).not.toBeNull();
  expect(d?.ruleRow).toBe(row);
  expect(d?.nextG).toBe(kg(nextKg));
  expect(d?.nextTargetReps).toBe(target);
  expect(d?.reasonCode).toBe(code);
}

describe("TESTING.md section 1: decision table", () => {
  it("D-01: 12,12,12 Good day 30 -> row 4, 18, 8, ADVANCE", () => {
    expectDecision(decideNext(input({ sets: sets([12, 12, 12], "good"), daysSinceFirstSession: 30 })), 4, 18, 8, "ADVANCE");
  });
  it("D-02: 12,12,12 Easy day 10 -> row 3, 20, 8, FAST_UP", () => {
    expectDecision(decideNext(input({ sets: sets([12, 12, 12], "easy"), daysSinceFirstSession: 10 })), 3, 20, 8, "FAST_UP");
  });
  it("D-03: 12,12,12 Easy day 40 -> row 4, 18, 8, ADVANCE", () => {
    expectDecision(decideNext(input({ sets: sets([12, 12, 12], "easy"), daysSinceFirstSession: 40 })), 4, 18, 8, "ADVANCE");
  });
  it("D-04: 14,14,14 Easy day 40 -> row 3 (lowest >= T + 2), 20, 8, FAST_UP", () => {
    expectDecision(decideNext(input({ sets: sets([14, 14, 14], "easy"), daysSinceFirstSession: 40 })), 3, 20, 8, "FAST_UP");
  });
  it("D-05: 12,12,12 Hard day 40 -> row 4 (any effort at top), 18, 8, ADVANCE", () => {
    expectDecision(decideNext(input({ sets: sets([12, 12, 12], "hard") })), 4, 18, 8, "ADVANCE");
  });
  it("D-06: 10,9,9 Good day 40 -> row 6, 16, 10, HOLD_PUSH", () => {
    expectDecision(decideNext(input({ sets: sets([10, 9, 9]) })), 6, 16, 10, "HOLD_PUSH");
  });
  it("D-07: 9,8,7 Good day 40 -> row 6 (one miss), 16, 8, HOLD_PUSH", () => {
    const d = decideNext(input({ sets: sets([9, 8, 7]) }));
    expectDecision(d, 6, 16, 8, "HOLD_PUSH");
    expect(d?.misses).toBe(1);
  });
  it("D-08: 9,7,7 Good day 40 -> row 2 (two misses), 14, 8, DELOAD_MISS", () => {
    expectDecision(decideNext(input({ sets: sets([9, 7, 7]) })), 2, 14, 8, "DELOAD_MISS");
  });
  it("D-09: 12,11,7 (7 tapped Failed) -> row 6, one set both below B and Failed is one miss, 16, 8, HOLD_PUSH", () => {
    const d = decideNext(input({ sets: sets([12, 11, 7], ["good", "good", "failed"]) }));
    expectDecision(d, 6, 16, 8, "HOLD_PUSH");
    expect(d?.misses).toBe(1);
  });
  it("D-10: 12, 8 (Failed), 7 -> row 2, two misses, 14, 8, DELOAD_MISS", () => {
    const d = decideNext(input({ sets: sets([12, 8, 7], ["good", "failed", "good"]) }));
    expectDecision(d, 2, 14, 8, "DELOAD_MISS");
    expect(d?.misses).toBe(2);
  });
  it("D-11: 8,8,8 Good day 40 -> row 6 (no misses, lowest 8), 16, 9, HOLD_PUSH", () => {
    expectDecision(decideNext(input({ sets: sets([8, 8, 8]) })), 6, 16, 9, "HOLD_PUSH");
  });
});
