// Saving and loading the training plan on the device, and merging it with the account's copy.
// The plan itself is never stored: it is rebuilt from the facts (finished workouts and pain answers) each time.

import { buildState, type PlanEvent, type PlanState, type SessionRecord } from "@liftly/workout";
import type { Backend, EventRow, LadderRow, Session } from "./backend";
import type { LadderRecord, LiftlyDb } from "./db";
import { enqueueEvent, enqueueLadder } from "./sync";

export interface WorkoutData {
  readonly state: PlanState;
  readonly ladders: Readonly<Record<string, readonly number[]>>;
  readonly active: SessionRecord | null;
  /** Exercises whose gym weights were edited on their own. */
  readonly custom: readonly string[];
}

export async function loadWorkoutData(db: LiftlyDb): Promise<WorkoutData> {
  const [events, ladders, active] = await Promise.all([db.events.toArray(), db.ladders.toArray(), db.active.get("current")]);
  return {
    state: buildState(events.map((e) => e.event)),
    ladders: Object.fromEntries(ladders.map((l) => [l.exerciseId, l.loadsG])),
    active: active?.session ?? null,
    custom: ladders.filter((l) => l.custom).map((l) => l.exerciseId),
  };
}

/** Saves the workout in progress after every tap, so closing the app or losing signal loses nothing (TESTING O-02). */
export async function saveActive(db: LiftlyDb, session: SessionRecord | null): Promise<void> {
  if (session === null) await db.active.delete("current");
  else await db.active.put({ id: "current", session });
}

const eventRow = (userId: string, e: PlanEvent): EventRow => ({ id: e.id, user_id: userId, kind: e.kind, occurred_at: e.at, data: e });
const ladderRow = (userId: string, l: LadderRecord): LadderRow => ({ user_id: userId, exercise_id: l.exerciseId, loads_g: [...l.loadsG], updated_at: l.updatedAt });

/**
 * Stores a finished workout or a follow-up answer. Signed in: it is queued for upload at once.
 * Signed out: it stays on the device and joins the account at sign-in (DECISIONS C7).
 */
export async function saveEvent(db: LiftlyDb, event: PlanEvent, userId: string | null, now: Date): Promise<void> {
  await db.events.put({ id: event.id, kind: event.kind, at: event.at, event, queuedFor: userId });
  if (userId !== null) await enqueueEvent(db, eventRow(userId, event), now);
  if (event.kind === "session") await db.active.delete("current");
}

export async function saveSessionFinished(db: LiftlyDb, session: SessionRecord, userId: string | null, now: Date): Promise<void> {
  if (session.endedAt === null) throw new Error("The workout is not finished");
  await saveEvent(db, { kind: "session", id: session.id, at: session.endedAt, session }, userId, now);
}

/** Saves the gym ladders for these exercises. `custom` marks an exercise edited on its own. */
export async function saveLadders(db: LiftlyDb, rows: readonly { exerciseId: string; loadsG: readonly number[] }[], opts: { custom: boolean; userId: string | null; now: Date }): Promise<void> {
  for (const r of rows) {
    const sorted = [...new Set(r.loadsG)].sort((a, b) => a - b);
    const rec: LadderRecord = { exerciseId: r.exerciseId, loadsG: sorted, updatedAt: opts.now.toISOString(), custom: opts.custom, queuedFor: opts.userId };
    await db.ladders.put(rec);
    if (opts.userId !== null) await enqueueLadder(db, ladderRow(opts.userId, rec), opts.now);
  }
}

/** At sign-in: queue everything made on this device while signed out. */
export async function queueLocalWork(db: LiftlyDb, userId: string, now: Date): Promise<void> {
  for (const e of await db.events.toArray()) {
    if (e.queuedFor === userId) continue;
    await enqueueEvent(db, eventRow(userId, e.event), now);
    await db.events.update(e.id, { queuedFor: userId });
  }
  for (const l of await db.ladders.toArray()) {
    if (l.queuedFor === userId) continue;
    await enqueueLadder(db, ladderRow(userId, l), now);
    await db.ladders.update(l.exerciseId, { queuedFor: userId });
  }
}

/**
 * Brings the account's workouts and gym weights onto this device. Events are facts with unique ids, so they only
 * add. A ladder from the account replaces the local one only if it is newer.
 */
export async function pullRemote(db: LiftlyDb, backend: Backend, session: Session): Promise<void> {
  const [events, ladders] = await Promise.all([backend.fetchEvents(), backend.fetchLadders()]);
  for (const row of events) {
    if (await db.events.get(row.id)) continue;
    const event = row.data as PlanEvent;
    if (event?.kind !== "session" && event?.kind !== "pain_followup") continue;
    await db.events.put({ id: row.id, kind: event.kind, at: event.at, event, queuedFor: session.userId });
  }
  for (const row of ladders) {
    const mine = await db.ladders.get(row.exercise_id);
    if (mine !== undefined && Date.parse(mine.updatedAt) >= Date.parse(row.updated_at)) continue;
    await db.ladders.put({ exerciseId: row.exercise_id, loadsG: [...row.loads_g], updatedAt: new Date(row.updated_at).toISOString(), custom: mine?.custom ?? false, queuedFor: session.userId });
  }
}
