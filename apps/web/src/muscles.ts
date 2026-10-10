// Display-only grouping of the exercise library by main muscle group, for the "Sets by muscle" card on Progress.
// It never feeds the engine or the plan, so it lives in the app rather than the catalog (which mirrors PROGRAMS.md).

export type MuscleGroup = "Legs" | "Chest" | "Back" | "Shoulders" | "Arms" | "Core";

export const MUSCLE_GROUPS: readonly MuscleGroup[] = ["Legs", "Chest", "Back", "Shoulders", "Arms", "Core"];

const GROUP: Readonly<Record<string, MuscleGroup>> = {
  leg_press: "Legs",
  seated_leg_curl: "Legs",
  goblet_squat: "Legs",
  dumbbell_romanian_deadlift: "Legs",
  leg_extension: "Legs",
  standing_calf_raise: "Legs",
  seated_calf_raise: "Legs",
  lying_leg_curl: "Legs",
  leg_press_calf_raise: "Legs",
  machine_glute_kickback: "Legs",
  machine_chest_press: "Chest",
  incline_dumbbell_press: "Chest",
  machine_pec_deck: "Chest",
  dumbbell_bench_press: "Chest",
  incline_machine_press: "Chest",
  cable_crossover: "Chest",
  lat_pulldown: "Back",
  seated_cable_row: "Back",
  chest_supported_row: "Back",
  back_extension_45: "Back",
  machine_pulldown: "Back",
  one_arm_dumbbell_row: "Back",
  dumbbell_shoulder_press: "Shoulders",
  cable_lateral_raise: "Shoulders",
  machine_shoulder_press: "Shoulders",
  dumbbell_lateral_raise: "Shoulders",
  triceps_pushdown: "Arms",
  dumbbell_bicep_curl: "Arms",
  overhead_cable_triceps_extension: "Arms",
  cable_bicep_curl: "Arms",
  ab_crunch_machine: "Core",
  cable_crunch: "Core",
};

export const muscleOf = (exerciseId: string): MuscleGroup => GROUP[exerciseId] ?? "Core";
