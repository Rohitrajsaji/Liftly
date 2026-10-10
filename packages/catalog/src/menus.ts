// Slot menus for plan tailoring (PROGRAMS.md section 3b, revision 1.2, draft pending sign-off). A menu lists the
// exercises that may fill one slot, the fixed plan's exercise first. test/menus.test.ts checks every menu against
// PROGRAMS.md, so change PROGRAMS.md first.

import type { ExerciseId } from "./exercises";
import type { ProgramId, SlotKey } from "./types";

export interface SlotMenu {
  readonly slotKey: SlotKey;
  readonly order: number;
  readonly options: readonly ExerciseId[];
}

const m = (slotKey: SlotKey, order: number, ...options: ExerciseId[]): SlotMenu => ({ slotKey, order, options });

export const MENUS: Readonly<Record<ProgramId, readonly SlotMenu[]>> = {
  "3-day": [
    m("A", 1, "leg_press", "goblet_squat"),
    m("A", 2, "machine_chest_press", "dumbbell_bench_press", "incline_machine_press"),
    m("A", 3, "lat_pulldown", "machine_pulldown"),
    m("A", 4, "seated_leg_curl", "lying_leg_curl"),
    m("A", 5, "triceps_pushdown", "overhead_cable_triceps_extension"),
    m("B", 1, "goblet_squat", "leg_press"),
    m("B", 2, "seated_cable_row", "chest_supported_row", "one_arm_dumbbell_row"),
    m("B", 3, "incline_dumbbell_press", "incline_machine_press", "dumbbell_bench_press"),
    m("B", 4, "dumbbell_romanian_deadlift"),
    m("B", 5, "dumbbell_bicep_curl", "cable_bicep_curl"),
    m("C", 1, "leg_extension"),
    m("C", 2, "dumbbell_shoulder_press", "machine_shoulder_press"),
    m("C", 3, "chest_supported_row", "seated_cable_row", "one_arm_dumbbell_row"),
    m("C", 4, "machine_pec_deck", "cable_crossover"),
    m("C", 5, "cable_lateral_raise", "dumbbell_lateral_raise"),
  ],
  "4-day": [
    m("U1", 1, "machine_chest_press", "dumbbell_bench_press", "incline_machine_press"),
    m("U1", 2, "lat_pulldown", "machine_pulldown"),
    m("U1", 3, "dumbbell_shoulder_press", "machine_shoulder_press"),
    m("U1", 4, "triceps_pushdown", "overhead_cable_triceps_extension"),
    m("U1", 5, "dumbbell_bicep_curl", "cable_bicep_curl"),
    m("L1", 1, "leg_press", "goblet_squat"),
    m("L1", 2, "dumbbell_romanian_deadlift"),
    m("L1", 3, "leg_extension"),
    m("L1", 4, "standing_calf_raise", "seated_calf_raise", "leg_press_calf_raise"),
    m("U2", 1, "incline_dumbbell_press", "incline_machine_press", "dumbbell_bench_press"),
    m("U2", 2, "seated_cable_row", "chest_supported_row", "one_arm_dumbbell_row"),
    m("U2", 3, "chest_supported_row", "seated_cable_row", "one_arm_dumbbell_row"),
    m("U2", 4, "machine_pec_deck", "cable_crossover"),
    m("U2", 5, "cable_lateral_raise", "dumbbell_lateral_raise"),
    m("L2", 1, "goblet_squat", "leg_press"),
    m("L2", 2, "seated_leg_curl", "lying_leg_curl"),
    m("L2", 3, "back_extension_45", "machine_glute_kickback"),
    m("L2", 4, "seated_calf_raise", "standing_calf_raise", "leg_press_calf_raise"),
    m("L2", 5, "ab_crunch_machine", "cable_crunch"),
  ],
};

/** The menu for one slot row. Throws when the program has no such row. */
export function menuFor(programId: ProgramId, slotKey: SlotKey, order: number): readonly ExerciseId[] {
  const found = MENUS[programId].find((x) => x.slotKey === slotKey && x.order === order);
  if (found === undefined) throw new Error(`No menu for ${programId} ${slotKey} ${order}`);
  return found.options;
}
