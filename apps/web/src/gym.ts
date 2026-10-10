// Gym weights: the list of loads the user's gym has, per kind of equipment. Every exercise starts on a standard
// commercial-gym list (Rohit, 2026-10-10) that the user can change; the engine only ever moves along the list in use,
// and each session keeps the list it used. Loads are integer grams everywhere.

import { exercise, MENUS, PROGRAMS, type Equipment, type ProgramId } from "@liftly/catalog";
import { formatKg, kgToGrams } from "@liftly/workout";

export const EQUIPMENT_ORDER: readonly Equipment[] = ["machine", "cable", "dumbbell", "bodyweight"];

export const MAX_LADDER_STEPS = 120;
export const MAX_LOAD_KG = 400;

/** Every exercise the program can ask for, in plan order: its rows, their swaps and the plan-tailoring menu options. */
function programExerciseIds(programId: ProgramId): string[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const s of PROGRAMS[programId].slots) {
    for (const r of s.exercises) {
      add(r.exerciseId);
      add(r.swapId);
      for (const m of MENUS[programId]) if (m.slotKey === s.key && m.order === r.order) m.options.forEach(add);
    }
  }
  return ids;
}

/** Equipment kinds the program (its exercises, swaps and tailoring options) actually uses. */
export function equipmentInUse(programId: ProgramId): Equipment[] {
  const used = new Set<Equipment>();
  for (const id of programExerciseIds(programId)) {
    const e = exercise(id).equipment;
    if (e !== null) used.add(e);
  }
  return EQUIPMENT_ORDER.filter((e) => used.has(e));
}

/** The program's exercises that use this kind of equipment, in plan order, without repeats. */
export function exercisesFor(programId: ProgramId, equipment: Equipment): string[] {
  return programExerciseIds(programId).filter((id) => exercise(id).equipment === equipment);
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

const steps = (fromKg: number, toKg: number, stepKg: number): number[] => rangeOf(kgToGrams(fromKg), kgToGrams(toKg), kgToGrams(stepKg)) ?? [];

/** Standard weights at a typical commercial gym, used until the user changes a list. Bodyweight adds held weight. */
export const STANDARD_LADDERS: Readonly<Record<Equipment, readonly number[]>> = {
  machine: steps(5, 150, 5),
  cable: steps(2.5, 80, 2.5),
  dumbbell: steps(2.5, 50, 2.5),
  bodyweight: [0, ...steps(2.5, 30, 2.5)],
};

/** The list an exercise uses: the user's own when saved, otherwise the standard one for its equipment. */
export function withStandardLadders(programId: ProgramId, saved: Readonly<Record<string, readonly number[]>>): Record<string, readonly number[]> {
  const out: Record<string, readonly number[]> = {};
  for (const e of equipmentInUse(programId)) for (const id of exercisesFor(programId, e)) out[id] = (saved[id]?.length ?? 0) > 0 ? (saved[id] ?? []) : STANDARD_LADDERS[e];
  return { ...saved, ...out };
}

/** The list the editor opens with when none is saved: the standard one. */
export function startingLadder(equipment: Equipment): number[] {
  return [...STANDARD_LADDERS[equipment]];
}

export const EQUIPMENT_HELP: Readonly<Record<Equipment, string>> = {
  machine: "Weight stack or plates on machines, like Leg Press or Chest Press.",
  cable: "Cable stack, like Lat Pulldown or Triceps Pushdown.",
  dumbbell: "The dumbbells your gym has. List each pair you can pick up.",
  bodyweight: "Extra weight you can hold. Keep 0 for just your body.",
};

export const exerciseName = (id: string): string => exercise(id).name;

export const kgList = (loadsG: readonly number[]): string => loadsG.map(formatKg).join(", ");
