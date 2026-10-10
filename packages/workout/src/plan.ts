// Today's workout: for each slot in the next program workout, which exercise (the original or its swap) and what the
// engine prescribes for it. Pure: the same state, ladders and date always give the same plan.

import { exercise, nextSlotKey, PROGRAMS, type Program, type ProgramId, type SlotKey } from "@liftly/catalog";
import { calibrationStart, daysBetween, ENGINE_VERSION, prescribe, REP_RANGES, type ExerciseType } from "@liftly/engine";
import { exerciseState, slotState } from "./state";
import type { ExerciseState, PlanState, PrescriptionRecord, WorkoutContext } from "./types";

export interface PlannedExercise {
  readonly slotOrder: number;
  /** The program's own exercise for this slot. */
  readonly slotExerciseId: string;
  /** The exercise to do: the original, or its swap after pain. Null when the slot is paused. */
  readonly exerciseId: string | null;
  /** The slot's swap: used after a pain report. */
  readonly swapId: string;
  readonly isSwap: boolean;
  readonly paused: boolean;
  readonly sets: number;
  readonly type: ExerciseType;
  readonly ladderG: readonly number[];
  readonly prescription: PrescriptionRecord | null;
  readonly previous: ExerciseState["lastPerformance"];
}

function typeOf(exerciseId: string): ExerciseType {
  const t = exercise(exerciseId).type;
  if (t === null) throw new Error(`${exerciseId} has no class`);
  return t;
}

/** Every exercise a program (the fixed one, or the tailored plan in force) can ask for, with its swaps, that has no ladder yet. */
export function exercisesMissingLadder(programId: ProgramId, ladders: WorkoutContext["ladders"], program?: Program): string[] {
  const ids = new Set<string>();
  for (const s of (program ?? PROGRAMS[programId]).slots) for (const r of s.exercises) ids.add(r.exerciseId).add(r.swapId);
  return [...ids].filter((id) => (ladders[id]?.length ?? 0) === 0);
}

export function nextWorkoutKey(state: PlanState, programId: ProgramId): SlotKey {
  const program = PROGRAMS[programId];
  const last = state.lastSlotKey !== null && program.sequence.includes(state.lastSlotKey) ? state.lastSlotKey : null;
  return nextSlotKey(programId, last);
}

export function daysSinceLast(state: PlanState, today: string): number {
  return state.lastSessionDate === null ? 0 : Math.max(0, daysBetween(state.lastSessionDate, today));
}

function prescriptionFor(state: PlanState, exerciseId: string, type: ExerciseType, ladderG: readonly number[], today: string): PrescriptionRecord {
  const ex = exerciseState(state, exerciseId);
  const range = REP_RANGES[type];
  if (ex.needsCalibration || ex.stored === null || ex.lastWorkingWeightG === null) {
    return {
      kind: "calibration",
      decisionType: "calibration",
      reasonCode: null,
      gapAdjustment: "none",
      weightG: calibrationStart(ladderG).weightG,
      targetReps: range.bottom,
      firstExposure: true,
      ladderEdge: false,
      engineVersion: ENGINE_VERSION,
    };
  }
  const p = prescribe({ exerciseType: type, ladderG, lastWorkingWeightG: ex.lastWorkingWeightG, stored: ex.stored, daysSinceLastSession: daysSinceLast(state, today) });
  if (p.kind === "calibration") {
    return { kind: "calibration", decisionType: "recalibration", reasonCode: "RECAL", gapAdjustment: "RECAL", weightG: p.rampStartG, targetReps: range.bottom, firstExposure: true, ladderEdge: p.ladderEdge, engineVersion: p.engineVersion };
  }
  return {
    kind: "working",
    decisionType: p.decisionType,
    reasonCode: p.reasonCode,
    gapAdjustment: p.gapAdjustment,
    weightG: p.weightG,
    targetReps: p.targetReps,
    firstExposure: p.firstExposure,
    ladderEdge: p.ladderEdge,
    engineVersion: p.engineVersion,
  };
}

/** The plan for one program workout on a given day (YYYY-MM-DD). Throws if a needed ladder is missing. */
export function planWorkout(state: PlanState, ctx: WorkoutContext, key: SlotKey, today: string): PlannedExercise[] {
  const workout = (ctx.program ?? PROGRAMS[ctx.programId]).slots.find((s) => s.key === key);
  if (workout === undefined) throw new Error(`Slot ${key} is not in program ${ctx.programId}`);
  return workout.exercises.map((row): PlannedExercise => {
    const slot = slotState(state, row.exerciseId);
    const type = typeOf(row.exerciseId);
    if (slot.paused) {
      return { slotOrder: row.order, slotExerciseId: row.exerciseId, swapId: row.swapId, exerciseId: null, isSwap: false, paused: true, sets: row.sets, type, ladderG: [], prescription: null, previous: null };
    }
    const useSwap = slot.pain.status !== "active";
    const exerciseId = useSwap ? row.swapId : row.exerciseId;
    const exType = typeOf(exerciseId);
    const ladderG = ctx.ladders[exerciseId];
    if (ladderG === undefined || ladderG.length === 0) throw new Error(`No ladder for ${exerciseId}`);
    return {
      slotOrder: row.order,
      slotExerciseId: row.exerciseId,
      swapId: row.swapId,
      exerciseId,
      isSwap: useSwap,
      paused: false,
      sets: row.sets,
      type: exType,
      ladderG,
      prescription: prescriptionFor(state, exerciseId, exType, ladderG, today),
      previous: exerciseState(state, exerciseId).lastPerformance,
    };
  });
}
