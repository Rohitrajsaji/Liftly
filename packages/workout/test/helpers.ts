import { exercise, PROGRAMS, type ProgramId, type SlotKey } from "@liftly/catalog";
import type { Effort } from "@liftly/engine";
import {
  applySession,
  EMPTY_STATE,
  finishSession,
  logSet,
  nextWorkoutKey,
  planWorkout,
  startSession,
  type PlanState,
  type SessionRecord,
  type WorkoutContext,
} from "../src";

export const kg = (n: number): number => Math.round(n * 1000);
export const kgs = (...ns: number[]): number[] => ns.map(kg);

/** TESTING.md ladder for every exercise; bodyweight exercises add load from 0. */
export const LADDER = kgs(6, 8, 10, 12, 14, 16, 18, 20, 22);
export const BODYWEIGHT_LADDER = kgs(0, 5, 10, 15);

export function ctxFor(programId: ProgramId = "3-day", startDate = "2026-10-01"): WorkoutContext {
  const ladders: Record<string, number[]> = {};
  for (const s of PROGRAMS[programId].slots)
    for (const r of s.exercises) for (const id of [r.exerciseId, r.swapId]) ladders[id] = exercise(id).equipment === "bodyweight" ? BODYWEIGHT_LADDER : LADDER;
  return { programId, startDate, ladders };
}

let counter = 0;
export const nextId = (): string => `id-${++counter}`;
export const at = (date: string, hour = 10): Date => new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);

export type Plan = { reps: number[]; efforts?: Effort | Effort[] } | "skip";

/** Logs sets on one exercise: reps[i] with efforts[i] (or one effort for all), stopping when the exercise has no more sets. */
export function logAll(s: SessionRecord, index: number, reps: number[], efforts: Effort | Effort[] = "good", now = at(s.date)): SessionRecord {
  let out = s;
  reps.forEach((r, i) => {
    out = logSet(out, index, { reps: r, effort: Array.isArray(efforts) ? (efforts[i] ?? "good") : efforts, now });
  });
  return out;
}

export interface Done {
  state: PlanState;
  session: SessionRecord;
}

/**
 * Runs a whole workout: `script(session)` logs the sets, then the session finishes and joins the plan.
 * `key` defaults to the next workout in the sequence.
 */
export function runWorkout(state: PlanState, ctx: WorkoutContext, date: string, script: (s: SessionRecord) => SessionRecord, key?: SlotKey): Done {
  const k = key ?? nextWorkoutKey(state, ctx.programId);
  const plan = planWorkout(state, ctx, k, date);
  const started = startSession(plan, { id: nextId(), programId: ctx.programId, slotKey: k, today: date, now: at(date), state });
  const finished = finishSession(script(started), state, at(date, 11));
  return { state: applySession(state, finished), session: finished };
}

export { EMPTY_STATE };
