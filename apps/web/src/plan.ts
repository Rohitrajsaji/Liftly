// The plan preview (PRD F2): the chosen program's workouts in order, straight from the frozen catalog.
// No weights: starting weights are found in each exercise's first session (calibration).

import { exercise, PROGRAMS, type Equipment, type ProgramId, type SlotKey } from "@liftly/catalog";
import { REP_RANGES } from "@liftly/engine";

export interface PreviewExercise {
  readonly order: number;
  readonly name: string;
  readonly sets: number;
  /** "8–12" or "10–15", from the exercise class. */
  readonly reps: string;
  readonly equipment: Equipment;
}

export interface PreviewWorkout {
  readonly key: SlotKey;
  readonly name: string;
  readonly exercises: readonly PreviewExercise[];
  readonly totalSets: number;
}

export interface PlanPreview {
  readonly programId: ProgramId;
  readonly name: string;
  readonly sessionsPerWeek: number;
  readonly workouts: readonly PreviewWorkout[];
}

export function planPreview(programId: ProgramId): PlanPreview {
  const program = PROGRAMS[programId];
  const workouts = program.sequence.map((key): PreviewWorkout => {
    const slot = program.slots.find((s) => s.key === key);
    if (slot === undefined) throw new Error(`Program ${programId} has no slot ${key}`);
    const exercises = slot.exercises.map((row): PreviewExercise => {
      const e = exercise(row.exerciseId);
      if (e.type === null || e.equipment === null) throw new Error(`${e.name} has no class or equipment`);
      const range = REP_RANGES[e.type];
      return { order: row.order, name: e.name, sets: row.sets, reps: `${range.bottom}–${range.top}`, equipment: e.equipment };
    });
    return { key, name: slot.name, exercises, totalSets: exercises.reduce((n, x) => n + x.sets, 0) };
  });
  return { programId, name: program.name, sessionsPerWeek: program.sessionsPerWeek, workouts };
}

export const EQUIPMENT_LABEL: Readonly<Record<Equipment, string>> = {
  machine: "Machine",
  cable: "Cable",
  dumbbell: "Dumbbell",
  bodyweight: "Bodyweight",
};
