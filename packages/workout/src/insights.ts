// Insights for the finish screen and Progress, read straight from finished sessions like progress.ts. Pure summaries:
// nothing here decides or suggests a weight or rep target (that is the engine's job); it only counts what was logged.

import { personalRecords, weekStart, type PersonalRecord } from "./progress";
import type { SessionRecord } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const parse = (d: string): number => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1);
};
const fmt = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export interface SessionStats {
  /** Whole minutes from start to end, or null when the end was not recorded. */
  readonly minutes: number | null;
  /** Working sets (ramp sets left out, as in volume). */
  readonly sets: number;
  readonly reps: number;
  /** Sum of weight × reps over working sets, in grams. */
  readonly volumeG: number;
}

export function sessionStats(s: SessionRecord): SessionStats {
  let sets = 0;
  let reps = 0;
  let volumeG = 0;
  for (const er of s.exercises)
    for (const set of er.sets) {
      if (set.kind !== "working") continue;
      sets += 1;
      reps += set.reps;
      volumeG += set.weightG * set.reps;
    }
  const minutes = s.endedAt === null ? null : Math.max(1, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000));
  return { minutes, sets, reps, volumeG };
}

/** Records this session set that beat an earlier record for the same exercise. A first ever session sets none. */
export function newRecords(sessions: readonly SessionRecord[], session: SessionRecord): PersonalRecord[] {
  const before = sessions.filter((s) => s.id !== session.id && (s.date < session.date || (s.date === session.date && s.startedAt < session.startedAt)));
  const old = new Map(personalRecords(before).map((p) => [p.exerciseId, p]));
  const ids = new Set(session.exercises.map((e) => e.exerciseId));
  return personalRecords([...before, session]).filter((p) => {
    const o = old.get(p.exerciseId);
    return ids.has(p.exerciseId) && p.date === session.date && o !== undefined && (p.weightG > o.weightG || (p.weightG === o.weightG && p.reps > o.reps));
  });
}

/** Every time a record improved, newest first: the records feed. */
export function recordHistory(sessions: readonly SessionRecord[]): PersonalRecord[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt));
  const out: PersonalRecord[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (s !== undefined) out.push(...newRecords(sorted.slice(0, i + 1), s));
  }
  return out.reverse();
}

export interface WeekTotals {
  readonly weekStart: string;
  readonly workouts: number;
  readonly sets: number;
  readonly reps: number;
  readonly minutes: number;
  readonly volumeG: number;
}

function totalsFor(sessions: readonly SessionRecord[], week: string): WeekTotals {
  const inWeek = sessions.filter((s) => weekStart(s.date) === week);
  const stats = inWeek.map(sessionStats);
  return {
    weekStart: week,
    workouts: inWeek.length,
    sets: stats.reduce((n, x) => n + x.sets, 0),
    reps: stats.reduce((n, x) => n + x.reps, 0),
    minutes: stats.reduce((n, x) => n + (x.minutes ?? 0), 0),
    volumeG: stats.reduce((n, x) => n + x.volumeG, 0),
  };
}

/** This week's totals next to last week's, for the "This week" card. */
export function weekCompare(sessions: readonly SessionRecord[], today: string): { readonly thisWeek: WeekTotals; readonly lastWeek: WeekTotals } {
  const w = weekStart(today);
  return { thisWeek: totalsFor(sessions, w), lastWeek: totalsFor(sessions, fmt(parse(w) - 7 * DAY)) };
}

/**
 * Weeks in a row with at least `perWeek` workouts, counting back from last week. This week joins the streak once it
 * reaches the target, so an unfinished week never breaks it.
 */
export function weekStreak(sessions: readonly SessionRecord[], today: string, perWeek: number): number {
  const counts = new Map<string, number>();
  for (const s of sessions) counts.set(weekStart(s.date), (counts.get(weekStart(s.date)) ?? 0) + 1);
  const thisWeek = parse(weekStart(today));
  let streak = (counts.get(fmt(thisWeek)) ?? 0) >= perWeek ? 1 : 0;
  for (let w = thisWeek - 7 * DAY; (counts.get(fmt(w)) ?? 0) >= perWeek; w -= 7 * DAY) streak += 1;
  return streak;
}

/** The days trained in the last `weeks` weeks (Monday-aligned), oldest week first: one row of 7 flags per week. */
export function trainingCalendar(sessions: readonly SessionRecord[], today: string, weeks = 12): { readonly weekStart: string; readonly days: readonly boolean[] }[] {
  const trained = new Set(sessions.map((s) => s.date));
  const thisWeek = parse(weekStart(today));
  const out: { weekStart: string; days: boolean[] }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisWeek - i * 7 * DAY;
    out.push({ weekStart: fmt(start), days: Array.from({ length: 7 }, (_, d) => trained.has(fmt(start + d * DAY))) });
  }
  return out;
}

/** Working sets per group in the week of `today`, for any grouping the caller gives (the app groups by muscle). */
export function setsByGroup(sessions: readonly SessionRecord[], today: string, groupOf: (exerciseId: string) => string): Record<string, number> {
  const w = weekStart(today);
  const out: Record<string, number> = {};
  for (const s of sessions) {
    if (weekStart(s.date) !== w) continue;
    for (const er of s.exercises) {
      const n = er.sets.filter((x) => x.kind === "working").length;
      if (n > 0) out[groupOf(er.exerciseId)] = (out[groupOf(er.exerciseId)] ?? 0) + n;
    }
  }
  return out;
}
