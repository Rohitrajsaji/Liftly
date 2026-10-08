// The workout state the screens share: what the plan remembers, the gym weights, and the workout in progress.
// The workout in progress is written to the device after every tap (TESTING O-02), so nothing is lost if the app closes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "./backend";
import type { LiftlyDb } from "./db";
import { slot } from "@liftly/catalog";
import { localDate, type Profile } from "./onboarding";
import { loadWorkoutData, saveActive, saveEvent, saveLadders, saveSessionFinished, type WorkoutData } from "./workoutStore";
import {
  EMPTY_STATE,
  finishSession,
  nextWorkoutKey,
  planWorkout,
  startSession,
  exercisesMissingLadder,
  type PlannedExercise,
  type SessionRecord,
  type WorkoutContext,
} from "@liftly/workout";

export interface WorkoutController {
  readonly ready: boolean;
  readonly data: WorkoutData;
  readonly ctx: WorkoutContext | null;
  readonly active: SessionRecord | null;
  /** Set right after a workout ends, until the user leaves the summary. */
  readonly finished: SessionRecord | null;
  readonly missingLadders: readonly string[];
  /** Name of the next workout (or the one in progress), e.g. "Upper Body". */
  readonly workoutName: string;
  /** Date and name of the last finished workout, for the Today screen. */
  readonly lastDone: string | null;
  /** True once the user has set up the gym, started or finished a workout. */
  readonly hasProgress: boolean;
  /** Today's plan, or null while a gym list is missing. */
  readonly plan: PlannedExercise[] | null;
  readonly planError: string | null;
  start(): void;
  /** Changes the workout in progress and saves it. */
  update(fn: (s: SessionRecord) => SessionRecord): void;
  finish(): Promise<void>;
  leaveSummary(): void;
  saveGym(rows: readonly { exerciseId: string; loadsG: readonly number[] }[], custom: boolean): Promise<void>;
  answerFollowUp(painId: string, stillPresent: boolean): Promise<void>;
  /** Discards a workout with no sets logged. */
  discard(): Promise<void>;
}

const EMPTY: WorkoutData = { state: EMPTY_STATE, ladders: {}, active: null, custom: [] };

export function useWorkout(db: LiftlyDb, profile: Profile, session: Session | null, onSaved: () => void, reloadKey: number): WorkoutController {
  const [data, setData] = useState<WorkoutData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<SessionRecord | null>(null);
  const [finished, setFinished] = useState<SessionRecord | null>(null);
  const userId = session?.userId ?? null;
  const activeRef = useRef<SessionRecord | null>(null);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(async () => {
    const d = await loadWorkoutData(db);
    setData(d);
    activeRef.current = d.active;
    setActive(d.active);
    setReady(true);
  }, [db]);

  useEffect(() => {
    void reload();
  }, [reload, reloadKey]);

  const ctx = useMemo<WorkoutContext | null>(
    () => (profile.programId === null || profile.startDate === null ? null : { programId: profile.programId, startDate: profile.startDate, ladders: data.ladders }),
    [profile.programId, profile.startDate, data.ladders],
  );

  const missingLadders = useMemo(() => (ctx === null ? [] : exercisesMissingLadder(ctx.programId, ctx.ladders)), [ctx]);

  const [plan, planError] = useMemo((): [PlannedExercise[] | null, string | null] => {
    if (ctx === null) return [null, null];
    try {
      const key = nextWorkoutKey(data.state, ctx.programId);
      // A swap may be in use without every other ladder being set; only a ladder the plan really needs blocks it.
      return [planWorkout(data.state, ctx, key, localDate(new Date())), null];
    } catch (e) {
      return [null, e instanceof Error ? e.message : "Could not build today's workout"];
    }
  }, [ctx, data.state]);

  const persist = useCallback(
    (s: SessionRecord | null) => {
      activeRef.current = s;
      setActive(s);
      writes.current = writes.current.then(() => saveActive(db, s)).catch(() => undefined);
    },
    [db],
  );

  const start = useCallback(() => {
    if (ctx === null || plan === null || activeRef.current !== null) return;
    const now = new Date();
    persist(startSession(plan, { id: crypto.randomUUID(), programId: ctx.programId, slotKey: nextWorkoutKey(data.state, ctx.programId), today: localDate(now), now, state: data.state }));
  }, [ctx, plan, data.state, persist]);

  const update = useCallback(
    (fn: (s: SessionRecord) => SessionRecord) => {
      const cur = activeRef.current;
      if (cur === null) return;
      persist(fn(cur));
    },
    [persist],
  );

  const finish = useCallback(async () => {
    const cur = activeRef.current;
    if (cur === null) return;
    const done = finishSession(cur, data.state, new Date());
    await writes.current;
    await saveSessionFinished(db, done, userId, new Date());
    activeRef.current = null;
    setActive(null);
    setFinished(done);
    const d = await loadWorkoutData(db);
    setData(d);
    onSaved();
  }, [db, data.state, userId, onSaved]);

  const discard = useCallback(async () => {
    persist(null);
    await writes.current;
  }, [persist]);

  const saveGym = useCallback(
    async (rows: readonly { exerciseId: string; loadsG: readonly number[] }[], custom: boolean) => {
      await saveLadders(db, rows, { custom, userId, now: new Date() });
      setData(await loadWorkoutData(db));
      onSaved();
    },
    [db, userId, onSaved],
  );

  const answerFollowUp = useCallback(
    async (painId: string, stillPresent: boolean) => {
      const now = new Date();
      await saveEvent(db, { kind: "pain_followup", id: crypto.randomUUID(), at: now.toISOString(), painId, stillPresent }, userId, now);
      setData(await loadWorkoutData(db));
      onSaved();
    },
    [db, userId, onSaved],
  );

  const workoutName = useMemo(() => {
    if (active !== null) return slot(active.programId, active.slotKey).name;
    return ctx === null ? "" : slot(ctx.programId, nextWorkoutKey(data.state, ctx.programId)).name;
  }, [active, ctx, data.state]);

  const lastDone = useMemo(() => {
    const { lastSessionDate, lastSlotKey } = data.state;
    if (lastSessionDate === null || lastSlotKey === null || ctx === null) return null;
    const [y, m, d] = lastSessionDate.split("-").map(Number);
    const day = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
    let name = lastSlotKey as string;
    try {
      name = slot(ctx.programId, lastSlotKey).name;
    } catch {
      // The program was changed since: show the key.
    }
    return `${name}, ${day}`;
  }, [data.state, ctx]);

  const hasProgress = active !== null || data.state.sessionsDone > 0 || Object.keys(data.ladders).length > 0;

  return { ready, data, ctx, workoutName, lastDone, hasProgress, active, finished, missingLadders, plan, planError, start, update, finish, leaveSummary: () => setFinished(null), saveGym, answerFollowUp, discard };
}
