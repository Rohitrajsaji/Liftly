// TESTING C-01 to C-08 through the workout layer: the ramp, working sets, and what the session records.
import { describe, expect, it } from "vitest";
import { currentStep, EMPTY_STATE, logSet, planWorkout, startSession, undoLastSet, workingSets, chooseWeight, finishSession } from "../src";
import { at, ctxFor, kg, logAll, nextId, runWorkout } from "./helpers";

const ctx = ctxFor("3-day");

function fresh() {
  const plan = planWorkout(EMPTY_STATE, ctx, "A", "2026-10-02");
  return startSession(plan, { id: nextId(), programId: "3-day", slotKey: "A", today: "2026-10-02", now: at("2026-10-02"), state: EMPTY_STATE });
}

describe("first session: every exercise starts with a ramp at the lowest ladder step", () => {
  it("prescribes calibration with no reason code (C5, R-02) and a first exposure (C1)", () => {
    const plan = planWorkout(EMPTY_STATE, ctx, "A", "2026-10-02");
    expect(plan).toHaveLength(5);
    for (const p of plan) {
      expect(p.prescription).toMatchObject({ kind: "calibration", decisionType: "calibration", reasonCode: null, firstExposure: true, weightG: kg(6) });
    }
    expect(plan.map((p) => p.exerciseId)).toEqual(["leg_press", "machine_chest_press", "lat_pulldown", "seated_leg_curl", "triceps_pushdown"]);
    expect(plan.map((p) => p.sets)).toEqual([3, 3, 3, 3, 2]);
  });
});

describe("C-01 ramp: 6 Easy, 8 Easy, 10 Good", () => {
  it("working weight 10; the 10 kg set is working set 1; two working sets remain at 10", () => {
    let s = fresh();
    s = logAll(s, 0, [8, 8], "easy");
    expect(currentStep(s.exercises[0]!)).toMatchObject({ kind: "ramp", weightG: kg(10), targetReps: 8, rampNo: 3 });
    s = logAll(s, 0, [8], "good");
    const er = s.exercises[0]!;
    expect(er.workingWeightG).toBe(kg(10));
    expect(er.sets.map((x) => [x.kind, x.partOfRamp, x.weightG])).toEqual([
      ["ramp", true, kg(6)],
      ["ramp", true, kg(8)],
      ["working", true, kg(10)],
    ]);
    expect(workingSets(er)).toHaveLength(1);
    // C-08: calibration session is a first exposure, miss floor B - 2 = 6.
    expect(currentStep(er)).toMatchObject({ kind: "working", weightG: kg(10), setNo: 2, totalSets: 3, targetReps: 8, missFloor: 6, firstExposure: true });
  });
});

describe("C-02 and C-03: Hard or Failed ends the ramp one step lower", () => {
  for (const effort of ["hard", "failed"] as const) {
    it(`6 Easy, 8 Easy, 10 Easy, 12 ${effort}: working weight 10, all three working sets at 10`, () => {
      let s = fresh();
      s = logAll(s, 0, [8, 8, 8], "easy");
      s = logAll(s, 0, [7], effort);
      const er = s.exercises[0]!;
      expect(er.workingWeightG).toBe(kg(10));
      expect(workingSets(er)).toHaveLength(0);
      expect(currentStep(er)).toMatchObject({ kind: "working", weightG: kg(10), setNo: 1, totalSets: 3 });
    });
  }
});

describe("C-04: five Easy ramp sets", () => {
  it("working weight is the 5th load (14); the 5th set stays a ramp set and all working sets follow at 14", () => {
    let s = fresh();
    s = logAll(s, 0, [8, 8, 8, 8, 8], "easy");
    const er = s.exercises[0]!;
    expect(er.sets.map((x) => x.weightG)).toEqual(kgs5());
    expect(er.workingWeightG).toBe(kg(14));
    expect(workingSets(er)).toHaveLength(0);
    expect(currentStep(er)).toMatchObject({ kind: "working", weightG: kg(14), setNo: 1 });
  });
});
function kgs5() {
  return [6, 8, 10, 12, 14].map(kg);
}

describe("C-05: Good on the first ramp set", () => {
  it("working weight 6; the ramp stops immediately", () => {
    let s = fresh();
    s = logAll(s, 0, [8], "good");
    expect(s.exercises[0]!.workingWeightG).toBe(kg(6));
    expect(currentStep(s.exercises[0]!)).toMatchObject({ kind: "working", weightG: kg(6), setNo: 2 });
  });
});

describe("C-06: ramp sets are not counted in volume", () => {
  it("the decision sees only working sets, including the Good set that ended the ramp", () => {
    const { session } = runWorkout(EMPTY_STATE, ctx, "2026-10-02", (s) => logAll(logAll(s, 0, [8, 8], "easy"), 0, [8, 9, 9], "good"));
    const d = session.exercises[0]!.outcome!.decision!;
    expect(d.input.sets).toHaveLength(3);
    expect(d.totalReps).toBe(26);
    expect(session.exercises[0]!.sets.filter((x) => x.kind === "ramp")).toHaveLength(2);
  });
});

describe("the exercise ends once all working sets are logged", () => {
  it("marks it done and refuses more sets", () => {
    let s = fresh();
    s = logAll(s, 0, [8, 8, 8], "good");
    expect(s.exercises[0]!.status).toBe("done");
    expect(currentStep(s.exercises[0]!)).toEqual({ kind: "complete" });
    expect(() => logSet(s, 0, { reps: 8, effort: "good", now: at(s.date) })).toThrow();
  });
});

describe("fixing a wrong tap", () => {
  it("taking back a Good ramp set returns to the ramp at that load", () => {
    let s = fresh();
    s = logAll(s, 0, [8], "easy");
    s = logAll(s, 0, [8], "good");
    expect(s.exercises[0]!.workingWeightG).toBe(kg(8));
    s = undoLastSet(s, 0);
    expect(s.exercises[0]!.workingWeightG).toBeNull();
    expect(currentStep(s.exercises[0]!)).toMatchObject({ kind: "ramp", weightG: kg(8) });
    s = undoLastSet(undoLastSet(s, 0), 0);
    expect(s.exercises[0]!.status).toBe("pending");
  });
});

describe("no weight changes during a workout (ENGINE section 10)", () => {
  it("the ramp start can be picked from the ladder before the first set, not after", () => {
    let s = fresh();
    s = chooseWeight(s, 0, kg(12));
    expect(currentStep(s.exercises[0]!)).toMatchObject({ kind: "ramp", weightG: kg(12) });
    expect(() => chooseWeight(s, 0, kg(13))).toThrow(/gym's list/);
    s = logAll(s, 0, [8], "easy");
    expect(() => chooseWeight(s, 0, kg(8))).toThrow(/can't change/);
  });

  it("every working set in a session is at one weight", () => {
    const { session } = runWorkout(EMPTY_STATE, ctx, "2026-10-02", (s) => logAll(logAll(s, 0, [8, 8], "easy"), 0, [8, 8, 8], "good"));
    const weights = new Set(workingSets(session.exercises[0]!).map((x) => x.weightG));
    expect(weights).toEqual(new Set([kg(10)]));
  });
});

describe("a ramp that is not finished", () => {
  it("leaves the exercise to calibrate again next time", () => {
    const { state, session } = runWorkout(EMPTY_STATE, ctx, "2026-10-02", (s) => logAll(s, 0, [8, 8], "easy"));
    expect(session.exercises[0]!.status).toBe("done");
    expect(session.exercises[0]!.outcome).toEqual({ decision: null, calibratedWeightG: null });
    expect(state.exercises["leg_press"]!.needsCalibration).toBe(true);
    const plan = planWorkout(state, ctx, "A", "2026-10-04");
    expect(plan[0]!.prescription).toMatchObject({ kind: "calibration", weightG: kg(6) });
  });

  it("a finished ramp with no working sets stores the working weight it found", () => {
    const { state } = runWorkout(EMPTY_STATE, ctx, "2026-10-02", (s) => logAll(s, 0, [8, 8, 8, 8], ["easy", "easy", "easy", "hard"]));
    expect(state.exercises["leg_press"]).toMatchObject({ needsCalibration: false, lastWorkingWeightG: kg(10), stored: { weightG: kg(10), targetReps: 8, firstExposure: true, reasonCode: null } });
  });
});

describe("a bodyweight exercise ramps on added load starting at 0 kg (PROGRAMS section 6)", () => {
  it("back extension starts at 0 kg", () => {
    const c4 = ctxFor("4-day");
    const plan = planWorkout(EMPTY_STATE, c4, "L2", "2026-10-02");
    const be = plan.find((p) => p.exerciseId === "back_extension_45")!;
    expect(be.prescription).toMatchObject({ kind: "calibration", weightG: 0 });
    const s = startSession(plan, { id: nextId(), programId: "4-day", slotKey: "L2", today: "2026-10-02", now: at("2026-10-02"), state: EMPTY_STATE });
    const i = s.exercises.findIndex((e) => e.exerciseId === "back_extension_45");
    const after = logAll(s, i, [10], "easy");
    expect(currentStep(after.exercises[i]!)).toMatchObject({ kind: "ramp", weightG: kg(5), targetReps: 10 });
    expect(finishSession(after, EMPTY_STATE, at("2026-10-02", 12)).completion).toBe("partial");
  });
});

describe("validation", () => {
  it("rejects reps that are not whole numbers from 0 to 100", () => {
    const s = fresh();
    for (const bad of [-1, 2.5, 101, Number.NaN]) expect(() => logSet(s, 0, { reps: bad, effort: "good", now: at(s.date) })).toThrow();
  });
});
