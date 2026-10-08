// Progress and history, read straight from finished sessions (PRD F14, MVP_SCOPE "Progress"). Nothing here is
// stored: it is a pure summary of the sessions, so a new phone shows the same numbers once the sessions are downloaded.

import { exercise } from "@liftly/catalog";
import { REP_RANGES } from "@liftly/engine";
import type { PlanEvent, SessionRecord } from "./types";

export function sessionsOf(events: readonly PlanEvent[]): SessionRecord[] {
  return events
    .flatMap((e) => (e.kind === "session" ? [e.session] : []))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt));
}

export interface WeightPoint {
  readonly date: string;
  /** The heaviest working-set weight that session, in grams (added load for bodyweight exercises). */
  readonly weightG: number;
  readonly totalReps: number;
  readonly sets: number;
}

/** Working weight per session for every exercise that has working sets, oldest first. Ramp sets and stopped-for-pain sessions without working sets are left out. */
export function weightHistory(sessions: readonly SessionRecord[]): Record<string, WeightPoint[]> {
  const out: Record<string, WeightPoint[]> = {};
  for (const s of sessions) {
    for (const er of s.exercises) {
      const work = er.sets.filter((x) => x.kind === "working");
      if (work.length === 0) continue;
      (out[er.exerciseId] ??= []).push({
        date: s.date,
        weightG: Math.max(...work.map((x) => x.weightG)),
        totalReps: work.reduce((n, x) => n + x.reps, 0),
        sets: work.length,
      });
    }
  }
  return out;
}

export interface PersonalRecord {
  readonly exerciseId: string;
  readonly weightG: number;
  /** The most reps done at that weight. */
  readonly reps: number;
  readonly date: string;
}

/**
 * The heaviest weight an exercise has been lifted for at least the bottom of its rep range (so a Failed attempt at a
 * too-heavy weight is not a record). Ties go to more reps, then the earlier date.
 */
export function personalRecords(sessions: readonly SessionRecord[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const s of sessions) {
    for (const er of s.exercises) {
      const type = exercise(er.exerciseId).type;
      if (type === null) continue;
      const floor = REP_RANGES[type].bottom;
      for (const set of er.sets) {
        if (set.kind !== "working" || set.reps < floor) continue;
        const cur = best.get(er.exerciseId);
        const better = cur === undefined || set.weightG > cur.weightG || (set.weightG === cur.weightG && set.reps > cur.reps);
        if (better) best.set(er.exerciseId, { exerciseId: er.exerciseId, weightG: set.weightG, reps: set.reps, date: s.date });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date) || a.exerciseId.localeCompare(b.exerciseId));
}

const DAY = 24 * 60 * 60 * 1000;
const parse = (d: string): number => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1);
};
const fmt = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The Monday of the week a date falls in. */
export function weekStart(date: string): string {
  const ms = parse(date);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  return fmt(ms - dow * DAY);
}

export interface WeekCount {
  readonly weekStart: string;
  readonly sessions: number;
}

/** Sessions per week for the last `weeks` weeks ending with the week of `today`, oldest first, including empty weeks. */
export function sessionsPerWeek(sessions: readonly SessionRecord[], today: string, weeks = 8): WeekCount[] {
  const thisWeek = parse(weekStart(today));
  const out: WeekCount[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ weekStart: fmt(thisWeek - i * 7 * DAY), sessions: 0 });
  for (const s of sessions) {
    const w = weekStart(s.date);
    const hit = out.find((x) => x.weekStart === w);
    if (hit !== undefined) (hit as { sessions: number }).sessions += 1;
  }
  return out;
}

export interface HistoryItem {
  readonly id: string;
  readonly date: string;
  readonly slotKey: string;
  readonly completion: "full" | "partial" | null;
  readonly exercises: readonly { readonly exerciseId: string; readonly status: string; readonly sets: readonly { readonly weightG: number; readonly reps: number; readonly kind: "ramp" | "working" }[] }[];
}

/** Finished workouts, newest first. */
export function history(sessions: readonly SessionRecord[]): HistoryItem[] {
  return [...sessions]
    .reverse()
    .map((s) => ({
      id: s.id,
      date: s.date,
      slotKey: s.slotKey,
      completion: s.completion,
      exercises: s.exercises
        .filter((e) => e.status !== "skipped")
        .map((e) => ({ exerciseId: e.exerciseId, status: e.status, sets: e.sets.map((x) => ({ weightG: x.weightG, reps: x.reps, kind: x.kind })) })),
    }));
}
