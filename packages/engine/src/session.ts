// In-session rules (section 10): no weight changes during a workout.

import { END_EXERCISE_BELOW_REPS } from "./constants";

export interface InSessionCheck {
  /** Always null: the engine never changes weight during a workout. */
  readonly weightChangeG: null;
  /** A set below 6 reps lets the user end this exercise for the session. */
  readonly mayEndExercise: boolean;
}

export function checkSetDuringSession(reps: number): InSessionCheck {
  return { weightChangeG: null, mayEndExercise: reps < END_EXERCISE_BELOW_REPS };
}

/** Whole days from one ISO date (YYYY-MM-DD) to another, in UTC so time zones cannot shift a day. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const ms = Date.parse(`${toIsoDate}T00:00:00Z`) - Date.parse(`${fromIsoDate}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${fromIsoDate} or ${toIsoDate}`);
  return Math.round(ms / 86_400_000);
}
