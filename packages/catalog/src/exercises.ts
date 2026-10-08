// The V1 exercise library: every exercise in PROGRAMS.md (revision 1.1), including those that appear
// only as swaps (section 3a). Loads always move along the user's gym ladder; nothing here sets increments.

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

  // Swap-only exercises (PROGRAMS.md section 3a).
  dumbbell_bench_press: { id: "dumbbell_bench_press", name: "Dumbbell Bench Press", type: "compound", equipment: "dumbbell", source: P },
  lying_leg_curl: { id: "lying_leg_curl", name: "Lying Leg Curl", type: "isolation", equipment: "machine", source: P },
  overhead_cable_triceps_extension: { id: "overhead_cable_triceps_extension", name: "Overhead Cable Triceps Extension", type: "isolation", equipment: "cable", source: P },
  incline_machine_press: { id: "incline_machine_press", name: "Incline Machine Press", type: "compound", equipment: "machine", source: P },
  cable_bicep_curl: { id: "cable_bicep_curl", name: "Cable Bicep Curl", type: "isolation", equipment: "cable", source: P },
  machine_shoulder_press: { id: "machine_shoulder_press", name: "Machine Shoulder Press", type: "compound", equipment: "machine", source: P },
  cable_crossover: { id: "cable_crossover", name: "Cable Crossover", type: "isolation", equipment: "cable", source: P },
  dumbbell_lateral_raise: { id: "dumbbell_lateral_raise", name: "Dumbbell Lateral Raise", type: "isolation", equipment: "dumbbell", source: P },
  leg_press_calf_raise: { id: "leg_press_calf_raise", name: "Leg Press Calf Raise", type: "isolation", equipment: "machine", source: P },
  machine_glute_kickback: { id: "machine_glute_kickback", name: "Machine Glute Kickback", type: "isolation", equipment: "machine", source: P },
  cable_crunch: { id: "cable_crunch", name: "Cable Crunch", type: "isolation", equipment: "cable", source: P },
  machine_pulldown: { id: "machine_pulldown", name: "Machine Pulldown", type: "compound", equipment: "machine", source: P },
  // [ASSUMPTION] class and equipment inferred from the name; PROGRAMS_QUESTIONS.md PQ5.
  one_arm_dumbbell_row: { id: "one_arm_dumbbell_row", name: "One-Arm Dumbbell Row", type: "compound", equipment: "dumbbell", source: P },
} as const satisfies Record<string, Exercise>;

export type ExerciseId = keyof typeof EXERCISES;

export function exercise(id: string): Exercise {
  const e = (EXERCISES as Record<string, Exercise>)[id];
  if (e === undefined) throw new Error(`Unknown exercise: ${id}`);
  return e;
}

/**
 * How a load is read (DATA_MODEL ladder load_definition). Bodyweight exercises record added load:
 * 0 kg is bodyweight only (PROGRAMS.md section 6).
 */
export function loadDefinition(id: string): "total" | "per_hand" | "displayed" | "added_load" {
  switch (exercise(id).equipment) {
    case "dumbbell":
      return "per_hand";
    case "machine":
    case "cable":
      return "displayed";
    case "bodyweight":
      return "added_load";
    case null:
      throw new Error(`Exercise ${id} has no equipment`);
  }
}

/** True when the engine can prescribe this exercise: its type and equipment are known. */
export function isPrescribable(id: string): boolean {
  const e = exercise(id);
  return e.type !== null && e.equipment !== null;
}
