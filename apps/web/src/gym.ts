// Gym weights: the list of loads the user's gym actually has, per kind of equipment. The user types them in; Liftly
// never assumes an increment (DECISIONS: the ladder is the user's own). Loads are integer grams everywhere.

import { exercise, PROGRAMS, type Equipment, type ProgramId } from "@liftly/catalog";
import { formatKg, kgToGrams } from "@liftly/workout";

export const EQUIPMENT_ORDER: readonly Equipment[] = ["machine", "cable", "dumbbell", "bodyweight"];

export const MAX_LADDER_STEPS = 120;
export const MAX_LOAD_KG = 400;

/** Equipment kinds the program (its exercises and their swaps) actually uses. */
export function equipmentInUse(programId: ProgramId): Equipment[] {
  const used = new Set<Equipment>();
  for (const s of PROGRAMS[programId].slots) {
    for (const r of s.exercises) {
      for (const id of [r.exerciseId, r.swapId]) {
        const e = exercise(id).equipment;
        if (e !== null) used.add(e);
      }
    }
  }
  return EQUIPMENT_ORDER.filter((e) => used.has(e));
}

/** The program's exercises (originals and swaps) that use this kind of equipment, in plan order, without repeats. */
export function exercisesFor(programId: ProgramId, equipment: Equipment): string[] {
  const ids: string[] = [];
  for (const s of PROGRAMS[programId].slots) {
    for (const r of s.exercises) {
      for (const id of [r.exerciseId, r.swapId]) if (exercise(id).equipment === equipment && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

export function allProgramExercises(programId: ProgramId): string[] {
  return equipmentInUse(programId).flatMap((e) => exercisesFor(programId, e));
}

/** Parses a kilogram entry such as "12.5" or "12,5". Null when it is not a usable number. */
export function parseKg(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const kg = Number(t);
  return kg <= MAX_LOAD_KG ? kgToGrams(kg) : null;
}

/** Every step from `from` to `to` (inclusive) by `step`, in grams. Null when the entry makes no sense. */
export function rangeOf(fromG: number, toG: number, stepG: number): number[] | null {
  if (stepG <= 0 || toG < fromG) return null;
  const out: number[] = [];
  for (let g = fromG; g <= toG; g += stepG) {
    out.push(g);
    if (out.length > MAX_LADDER_STEPS) return null;
  }
  return out;
}

export function mergeLadder(existing: readonly number[], add: readonly number[]): number[] {
  return [...new Set([...existing, ...add])].sort((a, b) => a - b);
}

export type LadderProblem = "too_few" | "too_many" | "zero_not_allowed" | null;

/** A ladder needs at least two steps. Zero (bodyweight only) belongs to bodyweight exercises alone. */
export function ladderProblem(loadsG: readonly number[], equipment: Equipment): LadderProblem {
  if (loadsG.length < 2) return "too_few";
  if (loadsG.length > MAX_LADDER_STEPS) return "too_many";
  if (equipment !== "bodyweight" && loadsG.includes(0)) return "zero_not_allowed";
  return null;
}

export const LADDER_PROBLEM_TEXT: Readonly<Record<Exclude<LadderProblem, null>, string>> = {
  too_few: "Add at least two weights.",
  too_many: "That's more weights than we can keep. Remove a few.",
  zero_not_allowed: "0 kg is only for bodyweight exercises.",
};

/** The first ladder when none is saved: nothing is assumed, the user fills it in. Bodyweight starts at 0. */
export function startingLadder(equipment: Equipment): number[] {
  return equipment === "bodyweight" ? [0] : [];
}

export const EQUIPMENT_HELP: Readonly<Record<Equipment, string>> = {
  machine: "Weight stack or plates on machines, like Leg Press or Chest Press.",
  cable: "Cable stack, like Lat Pulldown or Triceps Pushdown.",
  dumbbell: "The dumbbells your gym has. List each pair you can pick up.",
  bodyweight: "Extra weight you can hold. Keep 0 for just your body.",
};

export const exerciseName = (id: string): string => exercise(id).name;

export const kgList = (loadsG: readonly number[]): string => loadsG.map(formatKg).join(", ");
