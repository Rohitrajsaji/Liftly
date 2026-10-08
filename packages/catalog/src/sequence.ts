// Sequence-based plan (PRD F10, US-18): the next workout follows the last one done, whatever the weekday.

import { PROGRAMS } from "./programs";
import type { ProgramId, Slot, SlotKey } from "./types";

export function nextSlotKey(programId: ProgramId, lastDone: SlotKey | null): SlotKey {
  const seq = PROGRAMS[programId].sequence;
  const first = seq.at(0);
  if (first === undefined) throw new Error(`Program ${programId} has no slots`);
  if (lastDone === null) return first;
  const i = seq.indexOf(lastDone);
  if (i === -1) throw new Error(`Slot ${lastDone} is not in program ${programId}`);
  return seq.at((i + 1) % seq.length) ?? first;
}

export function slot(programId: ProgramId, key: SlotKey): Slot {
  const s = PROGRAMS[programId].slots.find((x) => x.key === key);
  if (s === undefined) throw new Error(`Slot ${key} is not in program ${programId}`);
  return s;
}

/** The approved swap for an exercise in a program. Each exercise has one swap per program. */
export function swapFor(programId: ProgramId, exerciseId: string): string {
  for (const s of PROGRAMS[programId].slots) {
    const row = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (row !== undefined) return row.swapId;
  }
  throw new Error(`Exercise ${exerciseId} is not in program ${programId}`);
}
