// Stall detection (section 7, row 5).

import { STALL_RESET_BREAK_DAYS, STALL_WINDOW } from "./constants";
import type { Exposure } from "./types";

export interface StallResult {
  /** Exposures at the current weight since the last reset, including the current one. */
  readonly counter: number;
  readonly stalled: boolean;
}

/**
 * The counter resets on any weight change and after any break longer than 14 days.
 * Stall = at least 3 exposures in the run, and the current total is not higher than the total
 * at the first of the last three (interpretation still [OPEN], DECISIONS.md section 2).
 */
export function detectStall(prior: readonly Exposure[], current: Exposure): StallResult {
  const run: Exposure[] = [current];
  if (current.daysSinceLastSession <= STALL_RESET_BREAK_DAYS) {
    for (let i = prior.length - 1; i >= 0; i--) {
      const e = prior.at(i);
      if (e === undefined || e.weightG !== current.weightG) break;
      run.unshift(e);
      // A long break before this exposure means the run started here.
      if (e.daysSinceLastSession > STALL_RESET_BREAK_DAYS) break;
    }
  }
  const counter = run.length;
  if (counter < STALL_WINDOW) return { counter, stalled: false };
  const first = run.at(-STALL_WINDOW);
  return { counter, stalled: first !== undefined && current.totalReps <= first.totalReps };
}
