// The V1 exercise library: every exercise in PROGRAMS.md, including those that appear only as swaps.
// Type and equipment come from PROGRAMS.md program rows. Swap-only exercises have them only when
// another spec document states them; the rest are null until Rohit supplies them (PROGRAMS_QUESTIONS.md).

import type { Exercise } from "./types";

const P = "PROGRAMS.md" as const;

export const EXERCISES = {
  leg_press: { id: "leg_press", name: "Leg Press", type: "compound", equipment: "machine", source: P },
  machine_chest_press: { id: "machine_chest_press", name: "Machine Chest Press", type: "compound", equipment: "machine", source: P },
  lat_pulldown: { id: "lat_pulldown", name: "Lat Pulldown", type: "compound", equipment: "cable", source: P },
  seated_leg_curl: { id: "seated_leg_curl", name: "Seated Leg Curl", type: "isolation", equipment: "machine", source: P },
  triceps_pushdown: { id: "triceps_pushdown", name: "Triceps Pushdown", type: "isolation", equipment: "cable", source: P },
  goblet_squat: { id: "goblet_squat", name: "Goblet Squat", type: "compound", equipment: "dumbbell", source: P },
  seated_cable_row: { id: "seated_cable_row", name: "Seated Cable Row", type: "compound", equipment: "cable", source: P },
  incline_dumbbell_press: { id: "incline_dumbbell_press", name: "Incline Dumbbell Press", type: "compound", equipment: "dumbbell", source: P },
  dumbbell_romanian_deadlift: { id: "dumbbell_romanian_deadlift", name: "Dumbbell Romanian Deadlift", type: "compound", equipment: "dumbbell", source: P },
  dumbbell_bicep_curl: { id: "dumbbell_bicep_curl", name: "Dumbbell Bicep Curl", type: "isolation", equipment: "dumbbell", source: P },
  leg_extension: { id: "leg_extension", name: "Leg Extension", type: "isolation", equipment: "machine", source: P },
  dumbbell_shoulder_press: { id: "dumbbell_shoulder_press", name: "Dumbbell Shoulder Press", type: "compound", equipment: "dumbbell", source: P },
  chest_supported_row: { id: "chest_supported_row", name: "Chest-Supported Row", type: "compound", equipment: "machine", source: P },
  machine_pec_deck: { id: "machine_pec_deck", name: "Machine Pec Deck", type: "isolation", equipment: "machine", source: P },
  cable_lateral_raise: { id: "cable_lateral_raise", name: "Cable Lateral Raise", type: "isolation", equipment: "cable", source: P },
  standing_calf_raise: { id: "standing_calf_raise", name: "Standing Calf Raise", type: "isolation", equipment: "machine", source: P },
  back_extension_45: { id: "back_extension_45", name: "45-Degree Back Extension", type: "isolation", equipment: "bodyweight", source: P },
  seated_calf_raise: { id: "seated_calf_raise", name: "Seated Calf Raise", type: "isolation", equipment: "machine", source: P },
  ab_crunch_machine: { id: "ab_crunch_machine", name: "Ab Crunch Machine", type: "isolation", equipment: "machine", source: P },

  // Swap-only exercises stated elsewhere in the spec.
  dumbbell_bench_press: { id: "dumbbell_bench_press", name: "Dumbbell Bench Press", type: "compound", equipment: "dumbbell", source: "TESTING.md" },
  dumbbell_lateral_raise: { id: "dumbbell_lateral_raise", name: "Dumbbell Lateral Raise", type: "isolation", equipment: "dumbbell", source: "TESTING.md" },

  // Swap-only exercises with no stated type or equipment.
  assisted_pull_up: { id: "assisted_pull_up", name: "Assisted Pull-up", type: null, equipment: null, source: null },
  lying_leg_curl: { id: "lying_leg_curl", name: "Lying Leg Curl", type: null, equipment: null, source: null },
  overhead_triceps_extension: { id: "overhead_triceps_extension", name: "Overhead Triceps Extension", type: null, equipment: null, source: null },
  incline_machine_press: { id: "incline_machine_press", name: "Incline Machine Press", type: null, equipment: null, source: null },
  cable_bicep_curl: { id: "cable_bicep_curl", name: "Cable Bicep Curl", type: null, equipment: null, source: null },
  machine_shoulder_press: { id: "machine_shoulder_press", name: "Machine Shoulder Press", type: null, equipment: null, source: null },
  cable_crossover: { id: "cable_crossover", name: "Cable Crossover", type: null, equipment: null, source: null },
  leg_press_calf_raise: { id: "leg_press_calf_raise", name: "Leg Press Calf Raise", type: null, equipment: null, source: null },
  machine_glute_kickback: { id: "machine_glute_kickback", name: "Machine Glute Kickback", type: null, equipment: null, source: null },
  cable_crunch: { id: "cable_crunch", name: "Cable Crunch", type: null, equipment: null, source: null },
} as const satisfies Record<string, Exercise>;

export type ExerciseId = keyof typeof EXERCISES;

export function exercise(id: string): Exercise {
  const e = (EXERCISES as Record<string, Exercise>)[id];
  if (e === undefined) throw new Error(`Unknown exercise: ${id}`);
  return e;
}

/** True when the engine can prescribe this exercise: its type and equipment are known. */
export function isPrescribable(id: string): boolean {
  const e = exercise(id);
  return e.type !== null && e.equipment !== null;
}
