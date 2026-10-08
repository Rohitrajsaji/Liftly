import type { ExerciseType } from "@liftly/engine";

export type Equipment = "machine" | "cable" | "dumbbell" | "bodyweight";

export type ProgramId = "3-day" | "4-day";

export type SlotKey = "A" | "B" | "C" | "U1" | "L1" | "U2" | "L2";

export interface Exercise {
  readonly id: string;
  /** Exact name from PROGRAMS.md. */
  readonly name: string;
  /** Null only while a spec document has not given it. */
  readonly type: ExerciseType | null;
  readonly equipment: Equipment | null;
  /** Where type and equipment come from. */
  readonly source: "PROGRAMS.md" | null;
}

export interface SlotExercise {
  readonly order: number;
  readonly exerciseId: string;
  readonly sets: number;
  /** Approved swap for this exercise in this program (PROGRAMS.md lists it per row). */
  readonly swapId: string;
}

export interface Slot {
  readonly key: SlotKey;
  /** Heading in PROGRAMS.md. */
  readonly name: string;
  readonly exercises: readonly SlotExercise[];
}

export interface Program {
  readonly id: ProgramId;
  readonly name: string;
  /** "Frequency" line in PROGRAMS.md. */
  readonly sessionsPerWeek: number;
  readonly sequence: readonly SlotKey[];
  readonly slots: readonly Slot[];
}
