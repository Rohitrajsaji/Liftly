// Miss counting (sections 2 and 8). A set is one miss if it is below the threshold or tapped Failed.

import { FIRST_EXPOSURE_FLOOR_DROP } from "./constants";
import type { RepRange, WorkingSet } from "./types";

/** B on a normal session, B - 2 on a first exposure. */
export function missThreshold(range: RepRange, firstExposure: boolean): number {
  return firstExposure ? range.bottom - FIRST_EXPOSURE_FLOOR_DROP : range.bottom;
}

export function isMiss(set: WorkingSet, threshold: number): boolean {
  return set.reps < threshold || set.effort === "failed";
}

export function countMisses(sets: readonly WorkingSet[], threshold: number): number {
  return sets.filter((s) => isMiss(s, threshold)).length;
}

export function lowestSet(sets: readonly WorkingSet[]): number | null {
  return sets.length === 0 ? null : Math.min(...sets.map((s) => s.reps));
}

export function totalReps(sets: readonly WorkingSet[]): number {
  return sets.reduce((sum, s) => sum + s.reps, 0);
}
