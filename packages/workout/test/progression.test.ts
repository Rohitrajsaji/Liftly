// The decision table, gap rules, pain policy and rebuilding state, driven through real workouts.
import { replayDecision } from "@liftly/engine";
import { describe, expect, it } from "vitest";
import {
  applyEvent,
  applyFollowUp,
  buildState,
  chooseWeight,
  EMPTY_STATE,
  exercisesMissingLadder,
  finishSession,
  logSet,
  nextWorkoutKey,
  planWorkout,
  reportPain,
  startSession,
  type PainInput,
  type PlanEvent,
  type PlanState,
  type SessionRecord,
} from "../src";
import { applySession } from "../src";
import { at, ctxFor, kg, logAll, nextId, runWorkout } from "./helpers";

const ctx = ctxFor("3-day");
const LEG = 0; // leg_press is exercise 1 of Workout A

/** First session of Workout A: leg press ramps 6 Easy, 8 Easy, 10 Good, then 8, 8 at 10. */
function calibrated() {
  return runWorkout(EMPTY_STATE, ctx, "2026-10-02", (s) => logAll(logAll(s, LEG, [8, 8], "easy"), LEG, [8, 8, 8], "good"), "A");
}

describe("after calibration", () => {
  it("the next target comes from the decision table and is stored for the next exposure", () => {
    const { state, session } = calibrated();
    const d = session.exercises[LEG]!.outcome!.decision!;
    // Sets 8,8,8 Good with miss floor 6: no misses, lowest 8 < 12: row 6 HOLD_PUSH, target 9.
    expect(d).toMatchObject({ ruleRow: 6, reasonCode: "HOLD_PUSH", previousG: kg(10), nextG: kg(10), nextTargetReps: 9 });
    expect(state.exercises["leg_press"]!.stored).toMatchObject({ weightG: kg(10), targetReps: 9, firstExposure: false, reasonCode: "HOLD_PUSH" });
    expect(state.exercises["leg_press"]!.firstSessionDate).toBe("2026-10-02");
    expect(state.lastSessionDate).toBe("2026-10-02");
  });

  it("the next workout in the sequence is B, whatever the weekday (US-18)", () => {
    expect(nextWorkoutKey(calibrated().state, "3-day")).toBe("B");
    expect(nextWorkoutKey(EMPTY_STATE, "3-day")).toBe("A");
    const { state } = runWorkout(calibrated().state, ctx, "2026-10-20", (s) => s, "B");
    expect(nextWorkoutKey(state, "3-day")).toBe("C");
  });

  it("previous performance is available for comparison (US-12)", () => {
    const plan = planWorkout(calibrated().state, ctx, "A", "2026-10-04");
    expect(plan[0]!.previous).toMatchObject({ date: "2026-10-02" });
    expect(plan[0]!.previous!.sets.map((x) => [x.kind, x.weightG, x.reps])).toEqual([
      ["ramp", kg(6), 8],
      ["ramp", kg(8), 8],
      ["working", kg(10), 8],
      ["working", kg(10), 8],
      ["working", kg(10), 8],
    ]);
  });
});

describe("decision rows through sessions", () => {
  it("ADVANCE: top of the range (any effort) moves up one step and the next session is a first exposure", () => {
    const first = calibrated();
    const { state, session } = runWorkout(first.state, ctx, "2026-10-04", (s) => logAll(s, LEG, [12, 12, 12], "good"), "A");
    expect(session.exercises[LEG]!.prescription).toMatchObject({ kind: "working", weightG: kg(10), targetReps: 9, reasonCode: "HOLD_PUSH" });
    expect(session.exercises[LEG]!.outcome!.decision).toMatchObject({ ruleRow: 4, reasonCode: "ADVANCE", nextG: kg(12), nextTargetReps: 8, nextIsFirstExposure: true });
    const plan = planWorkout(state, ctx, "A", "2026-10-06");
    expect(plan[LEG]!.prescription).toMatchObject({ kind: "working", weightG: kg(12), targetReps: 8, reasonCode: "ADVANCE", firstExposure: true });
  });

  it("FAST_UP: all Easy at the top of the range within 21 days moves up two steps", () => {
    const first = calibrated();
    const { session } = runWorkout(first.state, ctx, "2026-10-04", (s) => logAll(s, LEG, [12, 12, 12], "easy"), "A");
    expect(session.exercises[LEG]!.outcome!.decision).toMatchObject({ ruleRow: 3, reasonCode: "FAST_UP", nextG: kg(14), jump: true });
  });

  it("DELOAD_MISS: two sets under the floor drop to the highest step at or below 0.90 x W", () => {
    const first = calibrated();
    const { session } = runWorkout(first.state, ctx, "2026-10-04", (s) => logAll(s, LEG, [9, 7, 7], "good"), "A");
    // Normal session: floor is B = 8, so two sets of 7 are two misses. 0.9 x 10 = 9 -> 8 kg.
    expect(session.exercises[LEG]!.outcome!.decision).toMatchObject({ ruleRow: 2, reasonCode: "DELOAD_MISS", nextG: kg(8), nextTargetReps: 8 });
  });

  it("a first exposure lowers the miss floor to B - 2 for that session only", () => {
    const first = calibrated();
    const up = runWorkout(first.state, ctx, "2026-10-04", (s) => logAll(s, LEG, [12, 12, 12], "good"), "A");
    // At 12 kg (first exposure) reps of 6 are not misses; the session after at the same weight is not a first exposure.
    const firstExp = runWorkout(up.state, ctx, "2026-10-06", (s) => logAll(s, LEG, [6, 6, 6], "good"), "A");
    expect(firstExp.session.exercises[LEG]!.outcome!.decision).toMatchObject({ missThresholdUsed: 6, misses: 0, ruleRow: 6, nextG: kg(12), nextTargetReps: 8 });
    const normal = runWorkout(firstExp.state, ctx, "2026-10-08", (s) => logAll(s, LEG, [6, 6, 6], "good"), "A");
    expect(normal.session.exercises[LEG]!.outcome!.decision).toMatchObject({ missThresholdUsed: 8, misses: 3, ruleRow: 2, reasonCode: "DELOAD_MISS" });
  });

  it("every stored decision replays to the same result (DATA_MODEL section 4)", () => {
    let state = calibrated().state;
    const sessions: SessionRecord[] = [];
    for (const [date, reps] of [
      ["2026-10-04", [12, 12, 12]],
      ["2026-10-06", [9, 8, 8]],
      ["2026-10-08", [12, 12, 12]],
    ] as const) {
      const r = runWorkout(state, ctx, date, (s) => logAll(s, LEG, [...reps], "good"), "A");
      sessions.push(r.session);
      state = r.state;
    }
    for (const s of sessions) {
      const d = s.exercises[LEG]!.outcome!.decision!;
      expect(replayDecision(d)).toEqual({ matches: true, differences: [] });
    }
  });

  it("a stall is detected on the third exposure at one weight with no more total reps than the first", () => {
    // Exposure 1 is the calibration session (24 reps at 10 kg). Exposure 2 repeats it. Exposure 3 is the stall.
    const second = runWorkout(calibrated().state, ctx, "2026-10-04", (s) => logAll(s, LEG, [8, 8, 8], "good"), "A");
    expect(second.session.exercises[LEG]!.outcome!.decision).toMatchObject({ ruleRow: 6, stallCounter: 2 });
    const third = runWorkout(second.state, ctx, "2026-10-06", (s) => logAll(s, LEG, [8, 8, 8], "good"), "A");
    expect(third.session.exercises[LEG]!.outcome!.decision).toMatchObject({ ruleRow: 5, reasonCode: "STALL_DELOAD", stallCounter: 3, nextG: kg(8) });
  });
});

describe("gap and comeback (ENGINE section 6)", () => {
  const withWeight16 = () => {
    // Build a state with leg press at 16 kg by calibrating there: ramp 6..14 Easy then 16 Good.
    return runWorkout(EMPTY_STATE, ctx, "2026-10-02", (s) => logAll(logAll(s, LEG, [8, 8, 8, 8, 8], ["easy", "easy", "easy", "easy", "easy"]), LEG, [8, 8], "good"), "A");
  };

  it("0 to 7 days: no adjustment", () => {
    const { state } = calibrated();
    expect(planWorkout(state, ctx, "A", "2026-10-09")[LEG]!.prescription).toMatchObject({ gapAdjustment: "none", reasonCode: "HOLD_PUSH", weightG: kg(10) });
  });

  it("8 to 14 days: GAP_5, the gap code is the target's reason code (C5)", () => {
    const { state } = calibrated();
    const p = planWorkout(state, ctx, "A", "2026-10-12")[LEG]!.prescription!;
    // 0.95 x 10 = 9.5 -> highest step at or below is 8 kg.
    expect(p).toMatchObject({ kind: "working", decisionType: "gap", gapAdjustment: "GAP_5", reasonCode: "GAP_5", weightG: kg(8), targetReps: 8, firstExposure: false });
  });

  it("15 to 28 days: GAP_10", () => {
    const { state } = calibrated();
    expect(planWorkout(state, ctx, "A", "2026-10-20")[LEG]!.prescription).toMatchObject({ gapAdjustment: "GAP_10", reasonCode: "GAP_10", weightG: kg(8) });
  });

  it("more than 28 days: recalibrate from at or below 50% of the last working weight (G-06, C-07)", () => {
    const { state } = withWeight16();
    expect(state.exercises["leg_press"]!.lastWorkingWeightG).toBe(kg(14));
    const p = planWorkout(state, ctx, "A", "2026-11-10")[LEG]!.prescription!;
    expect(p).toMatchObject({ kind: "calibration", decisionType: "recalibration", reasonCode: "RECAL", gapAdjustment: "RECAL" });
    expect(p.weightG).toBeLessThanOrEqual(kg(7));
    const s = startSession(planWorkout(state, ctx, "A", "2026-11-10"), { id: nextId(), programId: "3-day", slotKey: "A", today: "2026-11-10", now: at("2026-11-10"), state });
    expect(() => chooseWeight(s, LEG, kg(10))).toThrow(/half/);
    expect(chooseWeight(s, LEG, kg(6)).exercises[LEG]!.rampStartG).toBe(kg(6));
  });

  it("the gap counts days since the last session of any kind, not of this exercise", () => {
    const { state } = calibrated();
    const b = runWorkout(state, ctx, "2026-10-12", (s) => s, "B"); // an empty session B still counts
    expect(planWorkout(b.state, ctx, "A", "2026-10-14")[LEG]!.prescription).toMatchObject({ gapAdjustment: "none" });
  });
});

const pain = (over: Partial<PainInput> = {}): PainInput => ({ id: nextId(), location: "knee", severity: 3, atRestOrNight: false, numbnessTinglingSwellingInstability: false, ...over });

function reportOnLeg(state: PlanState, date: string, p: PainInput) {
  const plan = planWorkout(state, ctx, "A", date);
  let s = startSession(plan, { id: nextId(), programId: "3-day", slotKey: "A", today: date, now: at(date), state });
  s = logAll(s, LEG, [8], "good");
  const r = reportPain(s, LEG, state, ctx, { pain: p, now: at(date, 10) });
  return { ...r, state, date };
}

describe("pain (SAFETY section 2, TESTING P-01 to P-10)", () => {
  it("P-01: pain stops the exercise, freezes the weight, and the next exposure is the swap with a ramp", () => {
    const base = calibrated().state;
    const r = reportOnLeg(base, "2026-10-04", pain({ severity: 3 }));
    expect(r.showProfessionalHelp).toBe(false);
    expect(r.session.exercises[LEG]!.status).toBe("stopped_pain");
    expect(() => logSet(r.session, LEG, { reps: 8, effort: "good", now: at(r.date) })).toThrow();
    const finished = finishSession(r.session, base, at("2026-10-04", 11));
    expect(finished.exercises[LEG]!.outcome!.decision).toMatchObject({ ruleRow: 1, reasonCode: "PAIN_SWAP", previousG: kg(10), nextG: kg(10) });
    const after = applySession(base, finished);
    expect(after.slots["leg_press"]!.pain.status).toBe("on_swap");
    expect(after.slots["leg_press"]!.pain.frozenWeightG).toBe(kg(10));
    const next = planWorkout(after, ctx, "A", "2026-10-06")[LEG]!;
    expect(next).toMatchObject({ exerciseId: "goblet_squat", isSwap: true, slotExerciseId: "leg_press" });
    expect(next.prescription).toMatchObject({ kind: "calibration", decisionType: "calibration", reasonCode: null });
    expect(finished.completion).toBe("partial");
  });

  it("P-10: only the exercise with pain is affected", () => {
    const base = calibrated().state;
    const r = reportOnLeg(base, "2026-10-04", pain());
    const after = applySession(base, finishSession(r.session, base, at("2026-10-04", 11)));
    const plan = planWorkout(after, ctx, "A", "2026-10-06");
    expect(plan.slice(1).map((p) => [p.exerciseId, p.isSwap])).toEqual([
      ["machine_chest_press", false],
      ["lat_pulldown", false],
      ["seated_leg_curl", false],
      ["triceps_pushdown", false],
    ]);
  });

  it("P-02: a Hard tap is effort, not pain", () => {
    const { session } = runWorkout(calibrated().state, ctx, "2026-10-04", (s) => logAll(s, LEG, [9, 9, 9], "hard"), "A");
    expect(session.exercises[LEG]!.pain).toBeNull();
    expect(session.exercises[LEG]!.outcome!.decision!.ruleRow).not.toBe(1);
  });

  const serious: [string, Partial<PainInput>][] = [
    ["P-03 severity 4", { severity: 4 }],
    ["P-04 at night or rest", { atRestOrNight: true }],
    ["P-06 numbness, tingling, swelling or instability", { numbnessTinglingSwellingInstability: true }],
  ];
  for (const [name, over] of serious) {
    it(`${name}: the professional-help screen is shown, and the swap takes the slot`, () => {
      const base = calibrated().state;
      const r = reportOnLeg(base, "2026-10-04", pain(over));
      expect(r.showProfessionalHelp).toBe(true);
      const after = applySession(base, finishSession(r.session, base, at("2026-10-04", 11)));
      expect(after.slots["leg_press"]!.pain.status).toBe("swap_permanent");
      expect(planWorkout(after, ctx, "A", "2026-10-06")[LEG]!.exerciseId).toBe("goblet_squat");
    });
  }

  it("P-05: still present after 24 hours escalates to the professional-help screen", () => {
    const base = calibrated().state;
    const r = reportOnLeg(base, "2026-10-04", pain());
    const after = applySession(base, finishSession(r.session, base, at("2026-10-04", 11)));
    expect(after.openFollowUps).toEqual([{ painId: r.record.id, slotExerciseId: "leg_press", exerciseId: "leg_press", reportedAt: at("2026-10-04", 10).toISOString() }]);
    expect(applyFollowUp(after, r.record.id, false).slots["leg_press"]!.pain.status).toBe("on_swap");
    const yes = applyFollowUp(after, r.record.id, true);
    expect(yes.slots["leg_press"]!.pain.status).toBe("swap_permanent");
    expect(yes.openFollowUps).toEqual([]);
  });

  it("P-08: two pain-free sessions on the swap bring the original back as a first exposure at the frozen weight", () => {
    const base = calibrated().state;
    const r = reportOnLeg(base, "2026-10-04", pain());
    let state = applySession(base, finishSession(r.session, base, at("2026-10-04", 11)));
    // Session 1 on the swap: ramp 6 Easy, 8 Good, then working sets.
    state = runWorkout(state, ctx, "2026-10-06", (s) => logAll(logAll(s, LEG, [8], "easy"), LEG, [8, 8, 8], "good"), "A").state;
    expect(state.slots["leg_press"]!.pain).toMatchObject({ status: "on_swap", painFreeSwapSessions: 1 });
    expect(planWorkout(state, ctx, "A", "2026-10-08")[LEG]).toMatchObject({ exerciseId: "goblet_squat", prescription: { kind: "working" } });
    state = runWorkout(state, ctx, "2026-10-08", (s) => logAll(s, LEG, [8, 8, 8], "good"), "A").state;
    expect(state.slots["leg_press"]!.pain.status).toBe("active");
    const back = planWorkout(state, ctx, "A", "2026-10-10")[LEG]!;
    expect(back).toMatchObject({ exerciseId: "leg_press", isSwap: false });
    expect(back.prescription).toMatchObject({ kind: "working", weightG: kg(10), targetReps: 8, firstExposure: true, reasonCode: null });
  });

  it("P-07: a second report within 4 weeks makes the swap permanent and shows the professional-help screen (C3)", () => {
    const base = calibrated().state;
    const first = reportOnLeg(base, "2026-10-04", pain({ severity: 2 }));
    let state = applySession(base, finishSession(first.session, base, at("2026-10-04", 11)));
    state = runWorkout(state, ctx, "2026-10-06", (s) => logAll(logAll(s, LEG, [8], "easy"), LEG, [8, 8, 8], "good"), "A").state;
    state = runWorkout(state, ctx, "2026-10-08", (s) => logAll(s, LEG, [8, 8, 8], "good"), "A").state;
    const second = reportOnLeg(state, "2026-10-12", pain({ severity: 2 }));
    expect(second.showProfessionalHelp).toBe(true);
    expect(second.record.seriousReasons).toContain("second_report_within_4_weeks");
    const after = applySession(state, finishSession(second.session, state, at("2026-10-12", 11)));
    expect(after.slots["leg_press"]!.pain.status).toBe("swap_permanent");
    expect(planWorkout(after, ctx, "A", "2026-10-14")[LEG]!.exerciseId).toBe("goblet_squat");
  });

  it("P-09 (default): pain on the swap pauses the slot; the original stays frozen", () => {
    const base = calibrated().state;
    const first = reportOnLeg(base, "2026-10-04", pain());
    let state = applySession(base, finishSession(first.session, base, at("2026-10-04", 11)));
    const plan = planWorkout(state, ctx, "A", "2026-10-06");
    let s = startSession(plan, { id: nextId(), programId: "3-day", slotKey: "A", today: "2026-10-06", now: at("2026-10-06"), state });
    s = logAll(s, LEG, [8], "easy");
    const r = reportPain(s, LEG, state, ctx, { pain: pain({ severity: 2 }), now: at("2026-10-06", 10) });
    expect(r.record.onSwap).toBe(true);
    state = applySession(state, finishSession(r.session, state, at("2026-10-06", 11)));
    expect(state.slots["leg_press"]).toMatchObject({ paused: true });
    expect(state.slots["leg_press"]!.pain.frozenWeightG).toBe(kg(10));
    const next = planWorkout(state, ctx, "A", "2026-10-08");
    expect(next[LEG]).toMatchObject({ paused: true, exerciseId: null, prescription: null });
    const started = startSession(next, { id: nextId(), programId: "3-day", slotKey: "A", today: "2026-10-08", now: at("2026-10-08"), state });
    expect(started.exercises).toHaveLength(4);
  });

  it("pain before the ramp found a working weight: the original ramps again when it returns", () => {
    const state0 = EMPTY_STATE;
    const plan = planWorkout(state0, ctx, "A", "2026-10-02");
    let s = startSession(plan, { id: nextId(), programId: "3-day", slotKey: "A", today: "2026-10-02", now: at("2026-10-02"), state: state0 });
    s = logAll(s, LEG, [8], "easy");
    const r = reportPain(s, LEG, state0, ctx, { pain: pain(), now: at("2026-10-02", 10) });
    let state = applySession(state0, finishSession(r.session, state0, at("2026-10-02", 11)));
    expect(state.slots["leg_press"]!.recalibrateOnReturn).toBe(true);
    state = runWorkout(state, ctx, "2026-10-04", (x) => logAll(logAll(x, LEG, [8], "easy"), LEG, [8, 8, 8], "good"), "A").state;
    state = runWorkout(state, ctx, "2026-10-06", (x) => logAll(x, LEG, [8, 8, 8], "good"), "A").state;
    expect(planWorkout(state, ctx, "A", "2026-10-08")[LEG]).toMatchObject({ exerciseId: "leg_press", prescription: { kind: "calibration" } });
  });
});

describe("partial workouts", () => {
  it("exercises that were not done leave the plan unchanged; the session still counts (completion partial)", () => {
    const { state, session } = runWorkout(EMPTY_STATE, ctx, "2026-10-02", (s) => logAll(logAll(s, LEG, [8, 8], "easy"), LEG, [8, 8, 8], "good"), "A");
    expect(session.completion).toBe("partial");
    expect(session.exercises.map((e) => e.status)).toEqual(["done", "skipped", "skipped", "skipped", "skipped"]);
    expect(state.exercises["machine_chest_press"]).toBeUndefined();
    expect(state.sessionsDone).toBe(1);
    expect(planWorkout(state, ctx, "A", "2026-10-04")[1]!.prescription!.kind).toBe("calibration");
  });

  it("ending an exercise early runs the table on the sets logged; sets not done are not misses", () => {
    const first = calibrated();
    const { session } = runWorkout(first.state, ctx, "2026-10-04", (s) => logAll(s, LEG, [12], "good"), "A");
    expect(session.exercises[LEG]!.status).toBe("done");
    expect(session.exercises[LEG]!.outcome!.decision).toMatchObject({ ruleRow: 4, reasonCode: "ADVANCE", misses: 0 });
  });
});

describe("rebuilding the plan from events", () => {
  it("applying events in any order of arrival gives the same state as applying them live", () => {
    let live = EMPTY_STATE;
    const events: PlanEvent[] = [];
    const script: [string, number[]][] = [
      ["2026-10-02", []],
      ["2026-10-04", [12, 12, 12]],
      ["2026-10-06", [8, 8, 8]],
    ];
    for (const [date, reps] of script) {
      const r =
        date === "2026-10-02"
          ? runWorkout(live, ctx, date, (s) => logAll(logAll(s, LEG, [8, 8], "easy"), LEG, [8, 8, 8], "good"), "A")
          : runWorkout(live, ctx, date, (s) => logAll(s, LEG, reps, "good"), "A");
      live = r.state;
      events.push({ kind: "session", id: r.session.id, at: r.session.endedAt!, session: r.session });
    }
    const shuffled = [events[2]!, events[0]!, events[1]!];
    expect(buildState(shuffled)).toEqual(live);
    expect(buildState(events)).toEqual(live);
    expect(events.reduce(applyEvent, EMPTY_STATE)).toEqual(live);
  });
});

describe("gym ladders", () => {
  it("lists the exercises (and swaps) that have no ladder yet", () => {
    expect(exercisesMissingLadder("3-day", {})).toHaveLength(new Set(Object.keys(ctxFor("3-day").ladders)).size);
    expect(exercisesMissingLadder("3-day", ctxFor("3-day").ladders)).toEqual([]);
  });

  it("planning without a ladder fails loudly rather than guessing a weight", () => {
    expect(() => planWorkout(EMPTY_STATE, { ...ctx, ladders: {} }, "A", "2026-10-02")).toThrow(/No ladder/);
  });

  it("targets only ever land on the gym's own ladder (US-15, AC-3)", () => {
    const odd = [5000, 7500, 10000, 15000, 22500];
    const c = { ...ctx, ladders: Object.fromEntries(Object.keys(ctx.ladders).map((k) => [k, odd])) };
    let state: PlanState = EMPTY_STATE;
    for (const [i, date] of ["2026-10-02", "2026-10-04", "2026-10-06", "2026-10-08", "2026-10-10"].entries()) {
      const r = runWorkout(state, c, date, (s) => (i === 0 ? logAll(logAll(s, LEG, [8], "easy"), LEG, [8, 8, 8], "good") : logAll(s, LEG, [12, 12, 12], "easy")), "A");
      state = r.state;
      for (const e of r.session.exercises) {
        const d = e.outcome?.decision;
        if (d) expect(odd).toContain(d.nextG);
      }
    }
  });
});
