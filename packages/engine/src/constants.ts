// Constants from PROGRESSION_ENGINE.md section 11. Factors are per-mille so ladder maths stays in integers.

import type { ExerciseType, ReasonCode, RepRange } from "./types";

export const ENGINE_VERSION = "1.0";

export const REP_RANGES: Readonly<Record<ExerciseType, RepRange>> = {
  compound: { bottom: 8, top: 12 },
  isolation: { bottom: 10, top: 15 },
};

export const DELOAD_FACTOR_PERMILLE = 900;
export const GAP_5_FACTOR_PERMILLE = 950;
export const GAP_10_FACTOR_PERMILLE = 900;
export const RECAL_START_FACTOR_PERMILLE = 500;

/** Increase above which the JUMP flag is set: more than 10%. */
export const JUMP_THRESHOLD_PERMILLE = 1100;

export const FAST_UP_WINDOW_DAYS = 21;
export const FAST_UP_STEPS = 2;
export const ADVANCE_STEPS = 1;

export const STALL_WINDOW = 3;
export const STALL_RESET_BREAK_DAYS = 14;

export const FIRST_EXPOSURE_FLOOR_DROP = 2;

export const GAP_NONE_MAX_DAYS = 7;
export const GAP_5_MAX_DAYS = 14;
export const GAP_10_MAX_DAYS = 28;

export const MAX_RAMP_SETS = 5;

/** A set below this many reps lets the user end the exercise for the session (section 10). */
export const END_EXERCISE_BELOW_REPS = 6;

export const PAIN_REPEAT_WINDOW_DAYS = 28;
export const PAIN_SEVERITY_SCREEN = 4;
export const PAIN_FREE_SWAP_SESSIONS_TO_RETURN = 2;

export const REASON_CODES: readonly ReasonCode[] = [
  "PAIN_SWAP",
  "DELOAD_MISS",
  "FAST_UP",
  "ADVANCE",
  "STALL_DELOAD",
  "HOLD_PUSH",
  "GAP_5",
  "GAP_10",
  "RECAL",
];
