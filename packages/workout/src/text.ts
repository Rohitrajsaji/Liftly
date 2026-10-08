// Fixed wording. Pain, serious-pain and swap messages are fixed text, never written by Claude (SAFETY.md section 5).
// The two pain messages are the drafts in SAFETY.md and still need approval by a qualified professional before testers.

import type { Effort, ExerciseType, ReasonCode } from "@liftly/engine";
import { REP_RANGES } from "@liftly/engine";
import { formatKg } from "./format";
import type { PainLocation } from "./types";

export const REASON_LINES: Readonly<Record<ReasonCode, string>> = {
  PAIN_SWAP: "You reported pain, so this exercise is paused and swapped next time.",
  DELOAD_MISS: "Two or more sets missed the target, so the weight goes down to the nearest lighter step.",
  FAST_UP: "Every set hit the top of the range and felt Easy, so the weight goes up two steps.",
  ADVANCE: "You reached the top of the range, so the weight goes up one step.",
  STALL_DELOAD: "The reps haven't gone up over three sessions at this weight, so the weight steps down to build back up.",
  HOLD_PUSH: "Same weight. Try for one more rep than your lowest set last time.",
  GAP_5: "It's been a little while, so the weight is a step lighter to ease back in.",
  GAP_10: "It's been a couple of weeks, so the weight is lighter to ease back in.",
  RECAL: "It's been more than four weeks, so you'll find your starting weight again.",
};

export const FIRST_EXPOSURE_LINE = "First time at this weight, so a couple of missed reps won't count against you today.";

export const PAIN_STOP_TEXT = "We've paused this exercise for today. Your next session will use an alternative. Your weight won't go up for this exercise until the pain has settled.";

export const SERIOUS_PAIN_TEXT =
  "Some of what you've reported is worth having checked by a qualified professional. Liftly can't tell what's causing it, so we've stopped suggesting this exercise. Your other exercises are unchanged.";

export const PAIN_ON_SWAP_TEXT =
  "We've paused this exercise for today. Liftly doesn't have another approved alternative for it, so it's left out of your workouts for now. Your other exercises are unchanged.";

export const PAUSED_SLOT_TEXT = "Left out for now. Liftly has no other approved alternative for this exercise.";

export const FOLLOW_UP_QUESTION = "Is the pain you reported still there?";

export function swapLine(originalName: string, swapName: string): string {
  return `Today you're doing ${swapName} instead of ${originalName}. It's an approved alternative from your plan.`;
}

export function calibrationLine(type: ExerciseType): string {
  return `Start light and go up one step at a time until ${REP_RANGES[type].bottom} reps feel Good.`;
}

export function workingWeightLine(weightG: number): string {
  return `Your working weight: ${formatKg(weightG)} kg.`;
}

export const EFFORT_LABEL: Readonly<Record<Effort, string>> = { easy: "Easy", good: "Good", hard: "Hard", failed: "Failed" };

export const EFFORT_HELP: Readonly<Record<Effort, string>> = {
  easy: "Plenty left in the tank",
  good: "A couple of reps left",
  hard: "Almost nothing left",
  failed: "Couldn't reach the target reps",
};

export const LOCATION_LABEL: Readonly<Record<PainLocation, string>> = {
  shoulder: "Shoulder",
  elbow: "Elbow",
  wrist: "Wrist",
  upper_back: "Upper back",
  lower_back: "Lower back",
  neck: "Neck",
  hip: "Hip",
  knee: "Knee",
  ankle: "Ankle",
  other: "Somewhere else",
};

/** Suggested rest between sets in seconds (PROGRAMS.md rest table; the ramp uses 1 to 2 minutes, PROGRESSION_ENGINE section 4). */
export function restRange(type: ExerciseType, ramp: boolean): { readonly minS: number; readonly maxS: number } {
  if (ramp) return { minS: 60, maxS: 120 };
  return type === "compound" ? { minS: 120, maxS: 180 } : { minS: 90, maxS: 120 };
}

export function restLabel(range: { readonly minS: number; readonly maxS: number }): string {
  const m = (s: number) => (s % 60 === 0 ? `${s / 60}` : `${s / 60}`.replace(/\.0$/, ""));
  return `${m(range.minS)}–${m(range.maxS)} min`;
}
