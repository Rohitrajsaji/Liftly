// Pain policy (SAFETY.md section 2 and 3, PROGRESSION_ENGINE.md section 9). Tracks one original
// exercise's status. The decision table's row 1 (PAIN_SWAP) handles the session itself.

import { SERIOUS_PAIN_SWAP_TAKES_SLOT } from "./assumptions";
import { PAIN_FREE_SWAP_SESSIONS_TO_RETURN, PAIN_REPEAT_WINDOW_DAYS, PAIN_SEVERITY_SCREEN } from "./constants";

export type PainStatus =
  /** Original exercise prescribed as normal. */
  | "active"
  /** Original frozen; the swap is prescribed until 2 pain-free swap sessions. */
  | "on_swap"
  /** Original no longer prescribed; the swap takes its slot. */
  | "swap_permanent";

export interface PainState {
  readonly status: PainStatus;
  /** Weight the original froze at; null while active and never frozen. */
  readonly frozenWeightG: number | null;
  readonly painFreeSwapSessions: number;
  /** Days (from any fixed origin, e.g. days since start) of every pain report on the original. */
  readonly reportDays: readonly number[];
}

export const INITIAL_PAIN_STATE: PainState = {
  status: "active",
  frozenWeightG: null,
  painFreeSwapSessions: 0,
  reportDays: [],
};

export interface PainReport {
  /** Day of the report, on the same scale as PainState.reportDays. */
  readonly day: number;
  readonly severity: number;
  readonly atRestOrNight: boolean;
  /** Null until the 24-hour follow-up question is answered. */
  readonly presentAfter24h: boolean | null;
  readonly numbnessTinglingSwellingInstability: boolean;
}

export type SeriousReason =
  | "severity"
  | "rest_or_night"
  | "after_24h"
  | "numbness_tingling_swelling_instability"
  | "second_report_within_4_weeks";

export interface PainOutcome {
  readonly state: PainState;
  /** The exercise stops for the rest of this session. */
  readonly stopForSession: true;
  /** Show the fixed professional-help screen (SAFETY.md section 3). */
  readonly showProfessionalHelp: boolean;
  readonly seriousReasons: readonly SeriousReason[];
  /** The next exposure of this slot uses the swap and starts with a ramp. */
  readonly nextUsesSwapWithRamp: boolean;
}

export function seriousReasons(report: PainReport, earlierReportDays: readonly number[]): SeriousReason[] {
  const reasons: SeriousReason[] = [];
  if (report.severity >= PAIN_SEVERITY_SCREEN) reasons.push("severity");
  if (report.atRestOrNight) reasons.push("rest_or_night");
  if (report.presentAfter24h === true) reasons.push("after_24h");
  if (report.numbnessTinglingSwellingInstability) reasons.push("numbness_tingling_swelling_instability");
  if (earlierReportDays.some((d) => report.day - d <= PAIN_REPEAT_WINDOW_DAYS && report.day >= d)) {
    reasons.push("second_report_within_4_weeks");
  }
  return reasons;
}

/** Pain reported on the original exercise during a session at working weight W. */
export function reportPain(state: PainState, report: PainReport, workingWeightG: number): PainOutcome {
  const reasons = seriousReasons(report, state.reportDays);
  const serious = reasons.length > 0;
  const frozen = state.frozenWeightG ?? workingWeightG;
  return {
    state: {
      status: serious && SERIOUS_PAIN_SWAP_TAKES_SLOT ? "swap_permanent" : "on_swap",
      frozenWeightG: frozen,
      painFreeSwapSessions: 0,
      reportDays: [...state.reportDays, report.day],
    },
    stopForSession: true,
    showProfessionalHelp: serious,
    seriousReasons: reasons,
    nextUsesSwapWithRamp: true,
  };
}

/** The 24-hour follow-up answer for the most recent report. "Yes" escalates to the professional-help screen. */
export function answerFollowUp24h(state: PainState, stillPresent: boolean): { state: PainState; showProfessionalHelp: boolean } {
  if (!stillPresent || state.status === "active") return { state, showProfessionalHelp: false };
  return { state: { ...state, status: "swap_permanent" }, showProfessionalHelp: true };
}

export interface SwapSessionResult {
  readonly state: PainState;
  /** The original returns at its next exposure, at the frozen weight, as a first exposure. */
  readonly originalReturns: boolean;
  readonly returnWeightG: number | null;
}

/**
 * A session on the swap finished. Two pain-free swap sessions in a row bring the original back
 * (SAFETY.md 2.4, TESTING P-08). Pain on the swap resets the count; the original stays frozen
 * (TESTING P-09, default) and row 1 applies to the swap's own decision.
 */
export function recordSwapSession(state: PainState, painOnSwap: boolean): SwapSessionResult {
  if (state.status !== "on_swap") return { state, originalReturns: false, returnWeightG: null };
  if (painOnSwap) return { state: { ...state, painFreeSwapSessions: 0 }, originalReturns: false, returnWeightG: null };
  const count = state.painFreeSwapSessions + 1;
  if (count >= PAIN_FREE_SWAP_SESSIONS_TO_RETURN) {
    return {
      state: { ...state, status: "active", painFreeSwapSessions: 0 },
      originalReturns: true,
      returnWeightG: state.frozenWeightG,
    };
  }
  return { state: { ...state, painFreeSwapSessions: count }, originalReturns: false, returnWeightG: null };
}
