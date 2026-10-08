// The plan state is a pure fold over events (finished sessions and pain follow-up answers), oldest first.
// Nothing else changes it, so a phone that downloads the full history rebuilds exactly the same state.

import { exercise, swapFor } from "@liftly/catalog";
import { answerFollowUp24h, INITIAL_PAIN_STATE, recordSwapSession, REP_RANGES } from "@liftly/engine";
import type { ExerciseState, PlanEvent, PlanState, SessionRecord, SlotState } from "./types";

export const EMPTY_STATE: PlanState = {
  exercises: {},
  slots: {},
  lastSessionDate: null,
  lastSlotKey: null,
  sessionsDone: 0,
  openFollowUps: [],
};

export function blankExercise(exerciseId: string): ExerciseState {
  return { exerciseId, firstSessionDate: null, lastWorkingWeightG: null, stored: null, exposures: [], lastPerformance: null, needsCalibration: true };
}

export function blankSlot(exerciseId: string): SlotState {
  return { exerciseId, pain: INITIAL_PAIN_STATE, paused: false, recalibrateOnReturn: false };
}

export const exerciseState = (state: PlanState, id: string): ExerciseState => state.exercises[id] ?? blankExercise(id);
export const slotState = (state: PlanState, id: string): SlotState => state.slots[id] ?? blankSlot(id);

function bottomReps(exerciseId: string): number {
  const type = exercise(exerciseId).type;
  if (type === null) throw new Error(`${exerciseId} has no class`);
  return REP_RANGES[type].bottom;
}

/** Applies one finished session. */
export function applySession(state: PlanState, session: SessionRecord): PlanState {
  let exercises: Record<string, ExerciseState> = { ...state.exercises };
  let slots: Record<string, SlotState> = { ...state.slots };
  const followUps = [...state.openFollowUps];
  const get = (id: string): ExerciseState => exercises[id] ?? blankExercise(id);

  for (const er of session.exercises) {
    if (er.status === "pending" || er.status === "skipped") continue;
    const before = get(er.exerciseId);
    let next: ExerciseState = before;
    const decision = er.outcome?.decision ?? null;
    const done = er.sets.filter((s) => s.kind === "working");

    if (decision !== null) {
      next = {
        ...next,
        stored: { weightG: decision.nextG, targetReps: decision.nextTargetReps, firstExposure: decision.nextIsFirstExposure, reasonCode: decision.reasonCode },
        lastWorkingWeightG: decision.previousG,
        // A pain stop is not a normal exposure, so it does not count toward a stall.
        exposures:
          decision.ruleRow === 1
            ? next.exposures
            : [...next.exposures, { weightG: decision.previousG, totalReps: decision.totalReps, daysSinceLastSession: decision.input.daysSinceLastSession }],
        needsCalibration: er.painBeforeCalibrated,
      };
    } else if (er.outcome?.calibratedWeightG != null) {
      next = {
        ...next,
        stored: { weightG: er.outcome.calibratedWeightG, targetReps: bottomReps(er.exerciseId), firstExposure: true, reasonCode: null },
        lastWorkingWeightG: er.outcome.calibratedWeightG,
        needsCalibration: false,
      };
    }
    if (er.sets.length > 0 || er.pain !== null) {
      next = {
        ...next,
        firstSessionDate: next.firstSessionDate ?? session.date,
        lastPerformance:
          er.sets.length > 0 ? { date: session.date, sets: er.sets.map((s) => ({ weightG: s.weightG, reps: s.reps, effort: s.effort, kind: s.kind })) } : next.lastPerformance,
      };
    }
    exercises[er.exerciseId] = next;

    const slotId = er.slotExerciseId;
    let slot = slots[slotId] ?? blankSlot(slotId);
    if (er.pain !== null && er.painStateAfter !== null) {
      slot = { ...slot, pain: er.painStateAfter, paused: er.slotPausedAfter, recalibrateOnReturn: er.pain.onSwap ? slot.recalibrateOnReturn : er.painBeforeCalibrated };
      if (!er.pain.onSwap) {
        // The next exposure uses the swap, starting with a ramp.
        const swapId = swapFor(session.programId, slotId);
        exercises[swapId] = { ...get(swapId), needsCalibration: true };
      }
      followUps.push({ painId: er.pain.id, slotExerciseId: slotId, exerciseId: er.exerciseId, reportedAt: er.pain.reportedAt });
    } else if (er.exerciseId !== slotId && done.length > 0) {
      // A pain-free session on the swap. Two in a row bring the original back at its frozen weight.
      const result = recordSwapSession(slot.pain, false);
      slot = { ...slot, pain: result.state };
      if (result.originalReturns) {
        const original = get(slotId);
        const recal = slot.recalibrateOnReturn || original.lastWorkingWeightG === null || result.returnWeightG === null;
        exercises[slotId] = recal
          ? { ...original, needsCalibration: true }
          : { ...original, needsCalibration: false, stored: { weightG: result.returnWeightG ?? 0, targetReps: bottomReps(slotId), firstExposure: true, reasonCode: null } };
        slot = { ...slot, recalibrateOnReturn: false };
      }
    }
    slots[slotId] = slot;
  }

  return {
    exercises,
    slots,
    lastSessionDate: session.date,
    lastSlotKey: session.slotKey,
    sessionsDone: state.sessionsDone + 1,
    openFollowUps: followUps,
  };
}

/** The user answered the 24-hour question for a pain report. "Still there" makes the swap permanent. */
export function applyFollowUp(state: PlanState, painId: string, stillPresent: boolean): PlanState {
  const open = state.openFollowUps.find((f) => f.painId === painId);
  if (open === undefined) return state;
  const openFollowUps = state.openFollowUps.filter((f) => f.painId !== painId);
  const slot = state.slots[open.slotExerciseId];
  if (slot === undefined) return { ...state, openFollowUps };
  const result = answerFollowUp24h(slot.pain, stillPresent);
  return { ...state, openFollowUps, slots: { ...state.slots, [open.slotExerciseId]: { ...slot, pain: result.state } } };
}

export function applyEvent(state: PlanState, event: PlanEvent): PlanState {
  return event.kind === "session" ? applySession(state, event.session) : applyFollowUp(state, event.painId, event.stillPresent);
}

/** Events in the order they happened. Ties break on id so every device agrees. */
export function sortEvents(events: readonly PlanEvent[]): PlanEvent[] {
  return [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

export function buildState(events: readonly PlanEvent[]): PlanState {
  return sortEvents(events).reduce(applyEvent, EMPTY_STATE);
}
