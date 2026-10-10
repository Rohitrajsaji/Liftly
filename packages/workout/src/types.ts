// Workout layer types. This layer ties the frozen programs (catalog) to the progression engine: it decides which
// exercise a slot uses today, runs the calibration ramp and the working sets, and applies the engine's decisions.
// It never invents a number: every weight and rep target comes from the engine (CLAUDE.md, "Engine decides").
// All loads are integer grams.

import type { PainState, ReasonCode, SeriousReason, Decision, Effort, Exposure, StoredTarget } from "@liftly/engine";
import type { Program, ProgramId, SlotKey } from "@liftly/catalog";

export type PainLocation = "shoulder" | "elbow" | "wrist" | "upper_back" | "lower_back" | "neck" | "hip" | "knee" | "ankle" | "other";

export const PAIN_LOCATIONS: readonly PainLocation[] = ["shoulder", "elbow", "wrist", "upper_back", "lower_back", "neck", "hip", "knee", "ankle", "other"];

export interface SetRecord {
  /** Ramp sets are not counted in volume. The Good set that ends a ramp is working set 1 (kind "working"). */
  readonly kind: "ramp" | "working";
  /** True for every set that took part in the calibration ramp, including the Good set that ended it. */
  readonly partOfRamp: boolean;
  readonly weightG: number;
  readonly reps: number;
  readonly effort: Effort;
  readonly loggedAt: string;
}

export interface PrescriptionRecord {
  readonly kind: "working" | "calibration";
  readonly decisionType: "normal" | "gap" | "calibration" | "recalibration";
  /** One reason code per prescription; the gap code wins when a gap applies; null for a first-time calibration (C5). */
  readonly reasonCode: ReasonCode | null;
  readonly gapAdjustment: "none" | "GAP_5" | "GAP_10" | "RECAL";
  /** Working: the weight to lift. Calibration: where the ramp starts. */
  readonly weightG: number;
  readonly targetReps: number;
  readonly firstExposure: boolean;
  readonly ladderEdge: boolean;
  readonly engineVersion: string;
}

export interface PainRecord {
  readonly id: string;
  readonly reportedAt: string;
  readonly exerciseId: string;
  readonly location: PainLocation;
  /** 0 to 10. */
  readonly severity: number;
  readonly atRestOrNight: boolean;
  readonly numbnessTinglingSwellingInstability: boolean;
  readonly seriousReasons: readonly SeriousReason[];
  readonly showedProfessionalHelp: boolean;
  /** True when the pain was on the slot's swap rather than its original exercise. */
  readonly onSwap: boolean;
}

export interface ExerciseOutcome {
  /** The engine's decision after the session (rows 1 to 6), or null when nothing was logged. */
  readonly decision: Decision | null;
  /** Set when the calibration ramp finished: the working weight it found. */
  readonly calibratedWeightG: number | null;
}

export type ExerciseStatus = "pending" | "in_progress" | "done" | "stopped_pain" | "skipped";

export interface ExerciseRecord {
  readonly slotOrder: number;
  /** The exercise actually done: the slot's original, or its swap. */
  readonly exerciseId: string;
  /** The program's own exercise for this slot. */
  readonly slotExerciseId: string;
  /** The slot's swap in the plan this session used (plan tailoring). Absent in older sessions: the program's swap applies. */
  readonly swapExerciseId?: string;
  readonly targetSets: number;
  readonly prescription: PrescriptionRecord;
  /** The gym ladder used, kept so the decision can be replayed. */
  readonly ladderG: readonly number[];
  /** Calibration only: where the ramp starts. Defaults to the prescription's start; the user may pick another ladder step. */
  readonly rampStartG: number | null;
  /** The working weight. For a calibration it is null until the ramp finishes. */
  readonly workingWeightG: number | null;
  readonly sets: readonly SetRecord[];
  readonly status: ExerciseStatus;
  readonly pain: PainRecord | null;
  /** The slot's pain state after this report, applied when the session finishes. */
  readonly painStateAfter: PainState | null;
  /** The slot had no safe alternative: the swap itself hurt (DECISIONS, swap of a swap). */
  readonly slotPausedAfter: boolean;
  /** True when the pain came before the ramp had found a working weight. */
  readonly painBeforeCalibrated: boolean;
  readonly outcome: ExerciseOutcome | null;
}

export interface SessionRecord {
  readonly id: string;
  readonly programId: ProgramId;
  readonly slotKey: SlotKey;
  /** Local date, YYYY-MM-DD. */
  readonly date: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly completion: "full" | "partial" | null;
  /** Days since the last session of any kind when this one started (0 for the first). */
  readonly daysSinceLastSession: number;
  readonly engineVersion: string;
  readonly exercises: readonly ExerciseRecord[];
}

/** What the plan remembers about one exercise. Built only by applying finished sessions in order. */
export interface ExerciseState {
  readonly exerciseId: string;
  readonly firstSessionDate: string | null;
  readonly lastWorkingWeightG: number | null;
  /** What the last decision stored for the next exposure. */
  readonly stored: StoredTarget | null;
  readonly exposures: readonly Exposure[];
  readonly lastPerformance: { readonly date: string; readonly sets: readonly { readonly weightG: number; readonly reps: number; readonly effort: Effort; readonly kind: "ramp" | "working" }[] } | null;
  /** True until the ramp has found a working weight (new exercise, a swap, or an unfinished ramp). */
  readonly needsCalibration: boolean;
}

export interface SlotState {
  /** The program's exercise for this slot (the original). */
  readonly exerciseId: string;
  readonly pain: PainState;
  /** The swap hurt too, so there is nothing safe to prescribe for this slot (DECISIONS defaults). */
  readonly paused: boolean;
  /** Pain came before the ramp found a working weight, so the original must ramp again when it returns. */
  readonly recalibrateOnReturn: boolean;
}

export interface FollowUp {
  readonly painId: string;
  /** The slot's own exercise, whose pain state the answer updates. */
  readonly slotExerciseId: string;
  /** The exercise the pain was reported on (the slot's original or its swap). */
  readonly exerciseId: string;
  readonly reportedAt: string;
}

export interface PlanState {
  readonly exercises: Readonly<Record<string, ExerciseState>>;
  readonly slots: Readonly<Record<string, SlotState>>;
  readonly lastSessionDate: string | null;
  readonly lastSlotKey: SlotKey | null;
  readonly sessionsDone: number;
  /** Pain reports whose 24-hour follow-up is unanswered, oldest first. */
  readonly openFollowUps: readonly FollowUp[];
}

/** Events that build the plan, oldest first. Sessions and follow-up answers are the only facts that change it. */
export type PlanEvent =
  | { readonly kind: "session"; readonly id: string; readonly at: string; readonly session: SessionRecord }
  | { readonly kind: "pain_followup"; readonly id: string; readonly at: string; readonly painId: string; readonly stillPresent: boolean };

export interface WorkoutContext {
  readonly programId: ProgramId;
  /** DATA_MODEL User.start_date, YYYY-MM-DD. Pain report days count from here. */
  readonly startDate: string;
  /** The gym ladder per exercise, in grams. */
  readonly ladders: Readonly<Record<string, readonly number[]>>;
  /** The tailored plan in force (PROGRAMS.md 3b). Absent: the fixed program. */
  readonly program?: Program;
}
