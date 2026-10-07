// Shared types for Progression Engine v1.0. All loads are integer grams.

export type Effort = "easy" | "good" | "hard" | "failed";

export type ExerciseType = "compound" | "isolation";

export type ReasonCode =
  | "PAIN_SWAP"
  | "DELOAD_MISS"
  | "FAST_UP"
  | "ADVANCE"
  | "STALL_DELOAD"
  | "HOLD_PUSH"
  | "GAP_5"
  | "GAP_10"
  | "RECAL";

export type DecisionType = "normal" | "calibration" | "gap" | "pain" | "recalibration";

export type RuleRow = 1 | 2 | 3 | 4 | 5 | 6;

export interface RepRange {
  readonly bottom: number;
  readonly top: number;
}

/** A working set as logged. Ramp sets never appear here. */
export interface WorkingSet {
  readonly reps: number;
  readonly effort: Effort;
}

/** A previous session in which this exercise was done, oldest first in any list. */
export interface Exposure {
  readonly weightG: number;
  readonly totalReps: number;
  /** Days since the last session of any kind, as it was when this exposure was performed. */
  readonly daysSinceLastSession: number;
}

/** Everything the decision table needs about one exercise in one finished session. */
export interface DecisionInput {
  readonly exerciseType: ExerciseType;
  /** The gym's ladder for this exercise, in grams. Need not be sorted. */
  readonly ladderG: readonly number[];
  /** W: the weight used for this session's working sets. */
  readonly workingWeightG: number;
  /** Working sets logged this session (ramp sets excluded). */
  readonly sets: readonly WorkingSet[];
  /** True when this session was a first exposure (after an increase, or a calibration session). */
  readonly firstExposure: boolean;
  /** True when pain was reported on this exercise this session. */
  readonly painReported: boolean;
  /** Days from this exercise's first session to this session ("day N" in TESTING.md). */
  readonly daysSinceFirstSession: number;
  /** Days from the previous session of any kind to this session. */
  readonly daysSinceLastSession: number;
  /** Earlier exposures of this exercise, oldest first, not including this session. */
  readonly priorExposures: readonly Exposure[];
}

export interface Decision {
  readonly engineVersion: string;
  readonly decisionType: "normal" | "pain";
  readonly ruleRow: RuleRow;
  readonly reasonCode: ReasonCode;
  readonly previousG: number;
  readonly nextG: number;
  readonly nextTargetReps: number;
  /** The next session at nextG is a first exposure (true only after an increase). */
  readonly nextIsFirstExposure: boolean;
  /** Data flag: the increase is more than 10%. Never a reason code. */
  readonly jump: boolean;
  /** Data flag: the ladder had no step where the rule wanted to go. */
  readonly ladderEdge: boolean;
  readonly missThresholdUsed: number;
  readonly misses: number;
  readonly lowestSet: number | null;
  readonly totalReps: number;
  /** Exposures at the current weight since the last reset, including this one. */
  readonly stallCounter: number;
  /** The exact input, kept so the decision can be replayed. */
  readonly input: DecisionInput;
}
