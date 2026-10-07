// TESTING.md section 7: pain. SAFETY.md sections 2 and 3.
import { describe, expect, it } from "vitest";
import {
  answerFollowUp24h,
  decideNext,
  INITIAL_PAIN_STATE,
  recordSwapSession,
  reportPain,
  type PainReport,
  type PainState,
} from "../../src";
import { input, kg, sets } from "../helpers";

const mild = (day: number, over: Partial<PainReport> = {}): PainReport => ({
  day,
  severity: 3,
  atRestOrNight: false,
  presentAfter24h: null,
  numbnessTinglingSwellingInstability: false,
  ...over,
});

describe("TESTING.md section 7: pain", () => {
  it("P-01: pain on set 2, severity 3, no other flags -> stop, row 1 PAIN_SWAP, frozen at W, next exposure is the swap with a ramp", () => {
    const d = decideNext(input({ sets: sets([10]), painReported: true }));
    expect(d?.ruleRow).toBe(1);
    expect(d?.reasonCode).toBe("PAIN_SWAP");
    expect(d?.nextG).toBe(kg(16));
    const o = reportPain(INITIAL_PAIN_STATE, mild(10), kg(16));
    expect(o.stopForSession).toBe(true);
    expect(o.showProfessionalHelp).toBe(false);
    expect(o.nextUsesSwapWithRamp).toBe(true);
    expect(o.state).toMatchObject({ status: "on_swap", frozenWeightG: kg(16) });
  });
  it("P-02: Hard tap for a burning muscle, no pain tap -> effort, not pain; normal rows apply", () => {
    const d = decideNext(input({ sets: sets([10, 10, 9], "hard") }));
    expect(d?.ruleRow).toBe(6);
    expect(d?.reasonCode).not.toBe("PAIN_SWAP");
  });
  it("P-03: severity 4 -> professional-help screen; exercise removed from prescriptions", () => {
    const o = reportPain(INITIAL_PAIN_STATE, mild(10, { severity: 4 }), kg(16));
    expect(o.showProfessionalHelp).toBe(true);
    expect(o.seriousReasons).toContain("severity");
    expect(o.state.status).toBe("swap_permanent");
  });
  it("P-04: pain at night -> professional-help screen", () => {
    expect(reportPain(INITIAL_PAIN_STATE, mild(10, { atRestOrNight: true }), kg(16)).showProfessionalHelp).toBe(true);
  });
  it("P-05: pain still present 24+ hours later -> professional-help screen", () => {
    const first = reportPain(INITIAL_PAIN_STATE, mild(10), kg(16));
    expect(first.showProfessionalHelp).toBe(false);
    const follow = answerFollowUp24h(first.state, true);
    expect(follow.showProfessionalHelp).toBe(true);
    expect(follow.state.status).toBe("swap_permanent");
    expect(reportPain(INITIAL_PAIN_STATE, mild(10, { presentAfter24h: true }), kg(16)).showProfessionalHelp).toBe(true);
  });
  it("P-06: numbness -> professional-help screen", () => {
    expect(reportPain(INITIAL_PAIN_STATE, mild(10, { numbnessTinglingSwellingInstability: true }), kg(16)).showProfessionalHelp).toBe(true);
  });
  it("P-07 (C3): second report on the same exercise within 4 weeks -> swap permanent, professional-help screen", () => {
    const first = reportPain(INITIAL_PAIN_STATE, mild(10), kg(16));
    const back: PainState = { ...first.state, status: "active" };
    const second = reportPain(back, mild(37), kg(16));
    expect(second.state.status).toBe("swap_permanent");
    expect(second.showProfessionalHelp).toBe(true);
    expect(second.seriousReasons).toEqual(["second_report_within_4_weeks"]);
    // A second report after more than 4 weeks is a normal pain report.
    expect(reportPain(back, mild(39), kg(16)).state.status).toBe("on_swap");
  });
  it("P-08: original returns only after 2 consecutive pain-free swap sessions, as a first exposure at the frozen weight", () => {
    const s0 = reportPain(INITIAL_PAIN_STATE, mild(10), kg(16)).state;
    const s1 = recordSwapSession(s0, false);
    expect(s1.originalReturns).toBe(false);
    const s2 = recordSwapSession(s1.state, false);
    expect(s2.originalReturns).toBe(true);
    expect(s2.returnWeightG).toBe(kg(16));
    expect(s2.state.status).toBe("active");
    // The returning session is a first exposure: the app passes firstExposure true, so the floor is B - 2.
    expect(decideNext(input({ sets: sets([7, 6, 6]), firstExposure: true }))?.misses).toBe(0);
    // Not consecutive: pain on the swap in between resets the count.
    const broken = recordSwapSession(recordSwapSession(s1.state, true).state, false);
    expect(broken.originalReturns).toBe(false);
  });
  it("P-09 [ASSUMPTION default]: pain on the swap -> row 1 applies to the swap; the original stays frozen", () => {
    const swapDecision = decideNext(input({ workingWeightG: kg(40), ladderG: [kg(35), kg(40), kg(45)], sets: sets([10]), painReported: true }));
    expect(swapDecision?.reasonCode).toBe("PAIN_SWAP");
    const s0 = reportPain(INITIAL_PAIN_STATE, mild(10), kg(16)).state;
    const after = recordSwapSession(s0, true);
    expect(after.state).toMatchObject({ status: "on_swap", frozenWeightG: kg(16), painFreeSwapSessions: 0 });
  });
  it("P-10: pain on exercise A, none on B -> only A is affected", () => {
    const a = decideNext(input({ sets: sets([10]), painReported: true }));
    const b = decideNext(input({ sets: sets([12, 12, 12]) }));
    expect(a?.reasonCode).toBe("PAIN_SWAP");
    expect(b?.reasonCode).toBe("ADVANCE");
    expect(reportPain(INITIAL_PAIN_STATE, mild(10), kg(16)).state.status).toBe("on_swap");
    expect(INITIAL_PAIN_STATE.status).toBe("active");
  });
  it("AC-6: pain prevents any weight increase at the next exposure, even with top-of-range sets", () => {
    const d = decideNext(input({ sets: sets([12, 12, 12], "easy"), painReported: true, daysSinceFirstSession: 5 }));
    expect(d?.nextG).toBe(kg(16));
  });
});
