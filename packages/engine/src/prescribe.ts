// Gap and comeback (section 6): applied when prescribing the first session after a break,
// to the last working weight. Days are counted from the last session of any kind.

import { GAP_CUT_IS_FIRST_EXPOSURE } from "./assumptions";
import {
  ENGINE_VERSION,
  GAP_10_FACTOR_PERMILLE,
  GAP_10_MAX_DAYS,
  GAP_5_FACTOR_PERMILLE,
  GAP_5_MAX_DAYS,
  GAP_NONE_MAX_DAYS,
  REP_RANGES,
} from "./constants";
import { highestAtOrBelow } from "./ladder";
import { recalibrationStart } from "./calibration";
import type { ExerciseType, ReasonCode } from "./types";

/** What the last decision stored for this exercise's next exposure. */
export interface StoredTarget {
  readonly weightG: number;
  readonly targetReps: number;
  readonly firstExposure: boolean;
  /** Null only for a first-time calibration (DECISIONS.md C5). */
  readonly reasonCode: ReasonCode | null;
}

export interface PrescriptionInput {
  readonly exerciseType: ExerciseType;
  readonly ladderG: readonly number[];
  /** The last working weight actually used (W), which the gap rule applies to. */
  readonly lastWorkingWeightG: number;
  readonly stored: StoredTarget;
  readonly daysSinceLastSession: number;
}

export type Prescription =
  | {
      readonly kind: "working";
      readonly decisionType: "normal" | "gap";
      readonly weightG: number;
      readonly targetReps: number;
      readonly firstExposure: boolean;
      readonly reasonCode: ReasonCode | null;
      readonly gapAdjustment: "none" | "GAP_5" | "GAP_10";
      readonly ladderEdge: boolean;
      readonly engineVersion: string;
    }
  | {
      readonly kind: "calibration";
      readonly decisionType: "recalibration";
      readonly rampStartG: number;
      readonly reasonCode: "RECAL";
      readonly gapAdjustment: "RECAL";
      readonly ladderEdge: boolean;
      readonly engineVersion: string;
    };

export function gapBand(days: number): "none" | "GAP_5" | "GAP_10" | "RECAL" {
  if (days <= GAP_NONE_MAX_DAYS) return "none";
  if (days <= GAP_5_MAX_DAYS) return "GAP_5";
  if (days <= GAP_10_MAX_DAYS) return "GAP_10";
  return "RECAL";
}

export function prescribe(input: PrescriptionInput): Prescription {
  const band = gapBand(input.daysSinceLastSession);
  const range = REP_RANGES[input.exerciseType];
  const W = input.lastWorkingWeightG;

  if (band === "none") {
    return {
      kind: "working",
      decisionType: "normal",
      weightG: input.stored.weightG,
      targetReps: input.stored.targetReps,
      firstExposure: input.stored.firstExposure,
      reasonCode: input.stored.reasonCode,
      gapAdjustment: "none",
      ladderEdge: false,
      engineVersion: ENGINE_VERSION,
    };
  }

  if (band === "RECAL") {
    const start = recalibrationStart(input.ladderG, W);
    return {
      kind: "calibration",
      decisionType: "recalibration",
      rampStartG: start.weightG,
      reasonCode: "RECAL",
      gapAdjustment: "RECAL",
      ladderEdge: start.ladderEdge,
      engineVersion: ENGINE_VERSION,
    };
  }

  const factor = band === "GAP_5" ? GAP_5_FACTOR_PERMILLE : GAP_10_FACTOR_PERMILLE;
  const cut = highestAtOrBelow(input.ladderG, W, factor);
  return {
    kind: "working",
    decisionType: "gap",
    weightG: cut.weightG,
    targetReps: range.bottom,
    firstExposure: GAP_CUT_IS_FIRST_EXPOSURE,
    reasonCode: band,
    gapAdjustment: band,
    ladderEdge: cut.ladderEdge,
    engineVersion: ENGINE_VERSION,
  };
}
