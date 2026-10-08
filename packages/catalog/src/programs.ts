// The frozen V1 programs, transcribed from PROGRAMS.md. test/programs.test.ts checks every field
// against that file, so any edit here that drifts from it fails.

import type { ExerciseId } from "./exercises";
import type { Program, SlotExercise } from "./types";

const row = (order: number, exerciseId: ExerciseId, sets: number, swapId: ExerciseId): SlotExercise => ({ order, exerciseId, sets, swapId });

export const THREE_DAY: Program = {
  id: "3-day",
  name: "3-Day Full-Body Program",
  sequence: ["A", "B", "C"],
  slots: [
    {
      key: "A",
      name: "Workout A",
      exercises: [
        row(1, "leg_press", 3, "goblet_squat"),
        row(2, "machine_chest_press", 3, "dumbbell_bench_press"),
        row(3, "lat_pulldown", 3, "assisted_pull_up"),
        row(4, "seated_leg_curl", 3, "lying_leg_curl"),
        row(5, "triceps_pushdown", 2, "overhead_triceps_extension"),
      ],
    },
    {
      key: "B",
      name: "Workout B",
      exercises: [
        row(1, "goblet_squat", 3, "leg_press"),
        row(2, "seated_cable_row", 3, "chest_supported_row"),
        row(3, "incline_dumbbell_press", 3, "incline_machine_press"),
        row(4, "dumbbell_romanian_deadlift", 3, "seated_leg_curl"),
        row(5, "dumbbell_bicep_curl", 2, "cable_bicep_curl"),
      ],
    },
    {
      key: "C",
      name: "Workout C",
      exercises: [
        row(1, "leg_extension", 3, "goblet_squat"),
        row(2, "dumbbell_shoulder_press", 3, "machine_shoulder_press"),
        row(3, "chest_supported_row", 3, "seated_cable_row"),
        row(4, "machine_pec_deck", 3, "cable_crossover"),
        row(5, "cable_lateral_raise", 3, "dumbbell_lateral_raise"),
      ],
    },
  ],
};

export const FOUR_DAY: Program = {
  id: "4-day",
  name: "4-Day Upper / Lower Program",
  sequence: ["U1", "L1", "U2", "L2"],
  slots: [
    {
      key: "U1",
      name: "Upper 1",
      exercises: [
        row(1, "machine_chest_press", 3, "dumbbell_bench_press"),
        row(2, "lat_pulldown", 3, "assisted_pull_up"),
        row(3, "dumbbell_shoulder_press", 3, "machine_shoulder_press"),
        row(4, "triceps_pushdown", 3, "overhead_triceps_extension"),
        row(5, "dumbbell_bicep_curl", 3, "cable_bicep_curl"),
      ],
    },
    {
      key: "L1",
      name: "Lower 1",
      exercises: [
        row(1, "leg_press", 3, "goblet_squat"),
        row(2, "dumbbell_romanian_deadlift", 3, "seated_leg_curl"),
        row(3, "leg_extension", 3, "leg_press"),
        row(4, "standing_calf_raise", 3, "leg_press_calf_raise"),
      ],
    },
    {
      key: "U2",
      name: "Upper 2",
      exercises: [
        row(1, "incline_dumbbell_press", 3, "incline_machine_press"),
        row(2, "seated_cable_row", 3, "chest_supported_row"),
        row(3, "chest_supported_row", 3, "lat_pulldown"),
        row(4, "machine_pec_deck", 3, "cable_crossover"),
        row(5, "cable_lateral_raise", 3, "dumbbell_lateral_raise"),
      ],
    },
    {
      key: "L2",
      name: "Lower 2",
      exercises: [
        row(1, "goblet_squat", 3, "leg_press"),
        row(2, "seated_leg_curl", 3, "lying_leg_curl"),
        row(3, "back_extension_45", 3, "machine_glute_kickback"),
        row(4, "seated_calf_raise", 3, "standing_calf_raise"),
        row(5, "ab_crunch_machine", 3, "cable_crunch"),
      ],
    },
  ],
};

export const PROGRAMS = { "3-day": THREE_DAY, "4-day": FOUR_DAY } as const;
