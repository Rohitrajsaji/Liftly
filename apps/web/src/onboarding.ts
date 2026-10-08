// Onboarding (PRD F1): training experience, program choice, goal confirmation, then the plan preview (F2).
// Pure state transitions; the screens and the local database only call these.

import type { ProgramId } from "@liftly/catalog";

export type Step = "welcome" | "experience" | "program" | "goal" | "preview";

export const STEPS: readonly Step[] = ["welcome", "experience", "program", "goal", "preview"];

export interface Profile {
  readonly step: Step;
  /** DATA_MODEL User.months_training. */
  readonly monthsTraining: number | null;
  readonly programId: ProgramId | null;
  readonly goalConfirmed: boolean;
}

export const NEW_PROFILE: Profile = { step: "welcome", monthsTraining: null, programId: null, goalConfirmed: false };

/** The stepper's range. Liftly is built for 0 to 12 months (MVP_SCOPE); higher values are kept as entered. */
export const MONTHS_MIN = 0;
export const MONTHS_MAX = 60;
export const BEGINNER_MAX_MONTHS = 12;

export function isBeyondBeginnerRange(months: number): boolean {
  return months > BEGINNER_MAX_MONTHS;
}

export function clampMonths(months: number): number {
  return Math.min(MONTHS_MAX, Math.max(MONTHS_MIN, Math.round(months)));
}

/** True when everything a step asks for has been given, so the user may move past it. */
export function isComplete(p: Profile, step: Step): boolean {
  switch (step) {
    case "welcome":
      return true;
    case "experience":
      return p.monthsTraining !== null;
    case "program":
      return p.programId !== null;
    case "goal":
      return p.goalConfirmed;
    case "preview":
      return true;
  }
}

/** The furthest step the user may open: the first step not yet complete, or the preview. */
export function furthestAllowed(p: Profile): Step {
  for (const s of STEPS) if (!isComplete(p, s)) return s;
  return "preview";
}

/** Moves to a step, but never past the first incomplete one. */
export function goTo(p: Profile, step: Step): Profile {
  const limit = STEPS.indexOf(furthestAllowed(p));
  const want = STEPS.indexOf(step);
  return { ...p, step: STEPS[Math.min(want, limit)] ?? "welcome" };
}

export function next(p: Profile): Profile {
  const i = STEPS.indexOf(p.step);
  return goTo(p, STEPS[Math.min(i + 1, STEPS.length - 1)] ?? "preview");
}

export function back(p: Profile): Profile {
  const i = STEPS.indexOf(p.step);
  return { ...p, step: STEPS[Math.max(i - 1, 0)] ?? "welcome" };
}

/** Changing the program from the preview reopens the program step; the other answers stay. */
export function changeProgram(p: Profile): Profile {
  return { ...p, step: "program" };
}

/** Repairs a stored profile: an unknown or unreachable step falls back to the furthest allowed one. */
export function normalize(p: Partial<Profile> | undefined): Profile {
  const months = typeof p?.monthsTraining === "number" ? clampMonths(p.monthsTraining) : null;
  const programId = p?.programId === "3-day" || p?.programId === "4-day" ? p.programId : null;
  const base: Profile = { step: "welcome", monthsTraining: months, programId, goalConfirmed: p?.goalConfirmed === true };
  const step = p?.step !== undefined && STEPS.includes(p.step) ? p.step : "welcome";
  return goTo(base, step);
}
