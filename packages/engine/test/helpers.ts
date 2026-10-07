import type { DecisionInput, Effort, Exposure, WorkingSet } from "../src";

export const kg = (n: number): number => Math.round(n * 1000);
export const kgs = (...ns: number[]): number[] => ns.map(kg);

/** TESTING.md conventions. */
export const COMPOUND_LADDER = kgs(6, 8, 10, 12, 14, 16, 18, 20, 22);
export const DUMBBELL_LADDER = kgs(6, 8, 10, 12, 14, 16, 18, 20);

export function sets(reps: number[], effort: Effort | Effort[] = "good"): WorkingSet[] {
  return reps.map((r, i) => ({ reps: r, effort: Array.isArray(effort) ? (effort[i] ?? "good") : effort }));
}

export function input(over: Partial<DecisionInput> & Pick<DecisionInput, "sets">): DecisionInput {
  return {
    exerciseType: "compound",
    ladderG: COMPOUND_LADDER,
    workingWeightG: kg(16),
    firstExposure: false,
    painReported: false,
    daysSinceFirstSession: 40,
    daysSinceLastSession: 2,
    priorExposures: [],
    ...over,
  };
}

export function exposures(weightKg: number, totals: number[], daysSinceLast = 2): Exposure[] {
  return totals.map((t) => ({ weightG: kg(weightKg), totalReps: t, daysSinceLastSession: daysSinceLast }));
}

/** Three working sets whose total is `total` and whose lowest is `lowest` (lowest first). */
export function setsWithTotal(total: number, lowest: number): WorkingSet[] {
  const rest = total - lowest;
  const a = Math.ceil(rest / 2);
  return sets([lowest, a, rest - a]);
}
