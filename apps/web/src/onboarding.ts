// Onboarding (PRD F1): training experience and program choice, then the plan preview (F2). The goal is
// always "build muscle" (the only V1 goal), so it is shown as information, not asked (DECISIONS U1).
// Pure state transitions; the screens and the local database only call these.

import type { ProgramId } from "@liftly/catalog";

export type Step = "welcome" | "experience" | "program" | "preview";

export const STEPS: readonly Step[] = ["welcome", "experience", "program", "preview"];

export interface Profile {
  readonly step: Step;
  /** DATA_MODEL User.months_training. */
  readonly monthsTraining: number | null;
  readonly programId: ProgramId | null;
  /** DATA_MODEL User.start_date, YYYY-MM-DD in the user's local time. Set when the plan is first shown. */
  readonly startDate: string | null;
}

export const NEW_PROFILE: Profile = { step: "welcome", monthsTraining: null, programId: null, startDate: null };

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
  const startDate = typeof p?.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.startDate) ? p.startDate : null;
  const base: Profile = { step: "welcome", monthsTraining: months, programId, startDate };
  // "goal" was a step in M4; profiles saved then continue to the preview.
  const stored: string | undefined = p?.step;
  const step: Step = stored === "goal" ? "preview" : STEPS.find((s) => s === stored) ?? "welcome";
  return goTo(base, step);
}

export function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Records the start date the first time the plan is shown. */
export function stampStartDate(p: Profile, now: Date): Profile {
  return p.step === "preview" && p.startDate === null ? { ...p, startDate: localDate(now) } : p;
}

/** All answers given: this is what an account stores. */
export function isOnboarded(p: Profile): boolean {
  return p.monthsTraining !== null && p.programId !== null && p.startDate !== null;
}
