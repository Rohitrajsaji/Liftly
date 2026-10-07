// Calibration ramp (section 4). Used for a new exercise, a swap, and a return after more than 28 days.

import { FIFTH_EASY_RAMP_COUNTS_AS_WORKING } from "./assumptions";
import { ENGINE_VERSION, MAX_RAMP_SETS, RECAL_START_FACTOR_PERMILLE, REP_RANGES } from "./constants";
import { highestAtOrBelow, normalizeLadder, previousStep, stepsUp, type LadderResult } from "./ladder";
import { missThreshold } from "./misses";
import type { Effort, ExerciseType } from "./types";

export interface RampSet {
  readonly weightG: number;
  readonly reps: number;
  readonly effort: Effort;
}

export interface RampInput {
  readonly exerciseType: ExerciseType;
  readonly ladderG: readonly number[];
  readonly startG: number;
  /** Ramp sets so far, in order. */
  readonly rampSets: readonly RampSet[];
  readonly recalibration: boolean;
}

export type RampStep =
  | { readonly kind: "ramp"; readonly weightG: number; readonly targetReps: number }
  | {
      readonly kind: "done";
      readonly engineVersion: string;
      readonly decisionType: "calibration" | "recalibration";
      /** C5: a first-time calibration has no reason code; a recalibration is RECAL. */
      readonly reasonCode: "RECAL" | null;
      readonly workingWeightG: number;
      /** True when the last ramp set (tapped Good) counts as working set 1. */
      readonly lastRampSetIsWorkingSet1: boolean;
      /** C1: the calibration session itself is the first exposure. */
      readonly firstExposure: true;
      readonly missThreshold: number;
      readonly targetReps: number;
      readonly ladderEdge: boolean;
    };

/** Starting load for a first-time calibration: the lowest ladder step (DECISIONS.md section 2). */
export function calibrationStart(ladderG: readonly number[]): LadderResult {
  const lowest = normalizeLadder(ladderG).at(0);
  if (lowest === undefined) throw new Error("Ladder is empty");
  return { weightG: lowest, ladderEdge: false };
}

/** Starting load after more than 28 days: at or below 50% of the last working weight. */
export function recalibrationStart(ladderG: readonly number[], lastWorkingWeightG: number): LadderResult {
  return highestAtOrBelow(ladderG, lastWorkingWeightG, RECAL_START_FACTOR_PERMILLE);
}

export function nextRampStep(input: RampInput): RampStep {
  const range = REP_RANGES[input.exerciseType];
  const last = input.rampSets.at(-1);
  if (last === undefined) return { kind: "ramp", weightG: input.startG, targetReps: range.bottom };

  const done = (w: LadderResult, lastIsWorking: boolean): RampStep => ({
    kind: "done",
    engineVersion: ENGINE_VERSION,
    decisionType: input.recalibration ? "recalibration" : "calibration",
    reasonCode: input.recalibration ? "RECAL" : null,
    workingWeightG: w.weightG,
    lastRampSetIsWorkingSet1: lastIsWorking,
    firstExposure: true,
    missThreshold: missThreshold(range, true),
    targetReps: range.bottom,
    ladderEdge: w.ladderEdge,
  });

  switch (last.effort) {
    case "good":
      return done({ weightG: last.weightG, ladderEdge: false }, true);
    case "hard":
    case "failed":
      // The previous ladder step below this load. At the bottom of the ladder, this step (default).
      return done(previousStep(input.ladderG, last.weightG), false);
    case "easy": {
      if (input.rampSets.length >= MAX_RAMP_SETS) {
        return done({ weightG: last.weightG, ladderEdge: false }, FIFTH_EASY_RAMP_COUNTS_AS_WORKING);
      }
      const up = stepsUp(input.ladderG, last.weightG, 1);
      if (up.ladderEdge) return done({ weightG: last.weightG, ladderEdge: true }, false);
      return { kind: "ramp", weightG: up.weightG, targetReps: range.bottom };
    }
  }
}
