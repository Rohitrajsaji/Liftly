// The six-row decision table (PROGRESSION_ENGINE.md section 5). Rows are checked top to bottom;
// the first match wins. Runs once per exercise after a session.

import { FAST_UP_WINDOW_INCLUSIVE } from "./assumptions";
import {
  ADVANCE_STEPS,
  DELOAD_FACTOR_PERMILLE,
  ENGINE_VERSION,
  FAST_UP_STEPS,
  FAST_UP_WINDOW_DAYS,
  JUMP_THRESHOLD_PERMILLE,
  REP_RANGES,
} from "./constants";
import { highestAtOrBelow, isJump, stepsUp, type LadderResult } from "./ladder";
import { countMisses, lowestSet, missThreshold, totalReps } from "./misses";
import { detectStall } from "./stall";
import type { Decision, DecisionInput, ReasonCode, RepRange, RuleRow } from "./types";

interface RowResult {
  readonly row: RuleRow;
  readonly code: ReasonCode;
  readonly next: LadderResult;
  readonly target: number;
}

function withinFastUpWindow(days: number): boolean {
  return FAST_UP_WINDOW_INCLUSIVE ? days <= FAST_UP_WINDOW_DAYS : days < FAST_UP_WINDOW_DAYS;
}

function clamp(n: number, range: RepRange): number {
  return Math.min(range.top, Math.max(range.bottom, n));
}

function validate(input: DecisionInput): void {
  // 0 g is bodyweight with no added load.
  if (!Number.isInteger(input.workingWeightG) || input.workingWeightG < 0) {
    throw new Error(`workingWeightG must be a non-negative integer of grams: ${input.workingWeightG}`);
  }
  for (const s of input.sets) {
    if (!Number.isInteger(s.reps) || s.reps < 0) throw new Error(`reps must be a non-negative integer: ${s.reps}`);
  }
  if (input.daysSinceFirstSession < 0 || input.daysSinceLastSession < 0) throw new Error("day counts must be >= 0");
}

/**
 * Decides the next prescription for one exercise. Returns null when no working set was logged and
 * no pain was reported: there is nothing to decide, so the previous prescription stands.
 */
export function decideNext(input: DecisionInput): Decision | null {
  validate(input);
  const range = REP_RANGES[input.exerciseType];
  const W = input.workingWeightG;
  const threshold = missThreshold(range, input.firstExposure);
  const misses = countMisses(input.sets, threshold);
  const lowest = lowestSet(input.sets);
  const total = totalReps(input.sets);
  const stall = detectStall(input.priorExposures, {
    weightG: W,
    totalReps: total,
    daysSinceLastSession: input.daysSinceLastSession,
  });

  if (!input.painReported && lowest === null) return null;

  const result = pickRow(input, range, W, misses, lowest, stall.stalled);
  const increased = result.next.weightG > W;
  return {
    engineVersion: ENGINE_VERSION,
    decisionType: result.row === 1 ? "pain" : "normal",
    ruleRow: result.row,
    reasonCode: result.code,
    previousG: W,
    nextG: result.next.weightG,
    nextTargetReps: result.target,
    nextIsFirstExposure: increased,
    jump: increased && isJump(W, result.next.weightG, JUMP_THRESHOLD_PERMILLE),
    ladderEdge: result.next.ladderEdge,
    missThresholdUsed: threshold,
    misses,
    lowestSet: lowest,
    totalReps: total,
    stallCounter: stall.counter,
    input,
  };
}

function pickRow(
  input: DecisionInput,
  range: RepRange,
  W: number,
  misses: number,
  lowest: number | null,
  stalled: boolean,
): RowResult {
  const keep: LadderResult = { weightG: W, ladderEdge: false };

  // Row 1: pain. Progression freezes at W; the next exposure uses the swap (see pain.ts).
  if (input.painReported) return { row: 1, code: "PAIN_SWAP", next: keep, target: range.bottom };

  // pickRow is only reached with at least one set when there is no pain.
  const low = lowest ?? 0;

  // Row 2: two or more misses.
  if (misses >= 2) {
    return { row: 2, code: "DELOAD_MISS", next: highestAtOrBelow(input.ladderG, W, DELOAD_FACTOR_PERMILLE), target: range.bottom };
  }

  // Row 3: fast up.
  const allEasy = input.sets.every((s) => s.effort === "easy");
  if (low >= range.top && allEasy && (withinFastUpWindow(input.daysSinceFirstSession) || low >= range.top + 2)) {
    return { row: 3, code: "FAST_UP", next: stepsUp(input.ladderG, W, FAST_UP_STEPS), target: range.bottom };
  }

  // Row 4: top of the range, any effort.
  if (low >= range.top) {
    return { row: 4, code: "ADVANCE", next: stepsUp(input.ladderG, W, ADVANCE_STEPS), target: range.bottom };
  }

  // Row 5: stall.
  if (stalled) {
    return { row: 5, code: "STALL_DELOAD", next: highestAtOrBelow(input.ladderG, W, DELOAD_FACTOR_PERMILLE), target: range.bottom };
  }

  // Row 6: hold and push.
  return { row: 6, code: "HOLD_PUSH", next: keep, target: clamp(low + 1, range) };
}
