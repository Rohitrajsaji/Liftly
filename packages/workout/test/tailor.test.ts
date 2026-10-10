// Plan tailoring (TESTING.md section 12, T-01 to T-13): the rules plan, the AI checks, and the tailored plan in real workouts.
import { exercise, EXERCISES, PROGRAMS, type Equipment, type ProgramId } from "@liftly/catalog";
import { describe, expect, it } from "vitest";
import {
  allowedOptions,
  applySession,
  avoidableExercises,
  buildState,
  buildTailoredPlan,
  EMPTY_STATE,
  finishSession,
  FIXED_EXPLANATION,
  fixedPicks,
  isStandardPlan,
  isValidTailoredPlan,
  parseTailoredPlan,
  NO_ANSWERS,
  planWorkout,
  reportPain,
  rulesPicks,
  startSession,
  tailoredProgram,
  tailorInput,
  type PlanEvent,
  type TailorAnswers,
  type WorkoutContext,
} from "../src";
import { at, kg, LADDER, logAll, nextId, runWorkout } from "./helpers";

const PROGRAM_IDS: ProgramId[] = ["3-day", "4-day"];
const answers = (over: Partial<TailorAnswers> = {}): TailorAnswers => ({ ...NO_ANSWERS, ...over });
const NOW = "2026-10-10T10:00:00.000Z";

/** An AI result that picks the first allowed option everywhere there is a choice, with the given picks replaced. */
function aiResult(programId: ProgramId, a: TailorAnswers, replace: Record<string, string> = {}, explanation = "Your plan uses the options that fit your gym.") {
  const picks = allowedOptions(programId, a)
    .filter((o) => o.allowed.length > 1)
    .map((o) => ({ slot_key: o.slotKey, order: o.order, exercise_id: replace[o.label] ?? o.allowed[0] }));
  return { picks, explanation_text: explanation };
}

const idsOf = (picks: readonly { exerciseId: string }[]) => picks.map((p) => p.exerciseId);
const ctxWith = (programId: ProgramId, picks?: ReturnType<typeof fixedPicks>): WorkoutContext => ({
  programId,
  startDate: "2026-10-01",
  ladders: Object.fromEntries(Object.values(EXERCISES).map((e) => [e.id, LADDER])),
  ...(picks === undefined ? {} : { program: tailoredProgram(programId, picks) }),
});

describe("plan tailoring (TESTING.md section 12)", () => {
  for (const programId of PROGRAM_IDS) {
    it(`T-01: no answers gives exactly the fixed plan (${programId})`, () => {
      const plan = buildTailoredPlan({ programId, answers: NO_ANSWERS, ai: null, createdAt: NOW });
      expect(plan.picks).toEqual(fixedPicks(programId));
      expect(plan.keptFixed).toEqual([]);
      expect(isStandardPlan(plan)).toBe(true);
      const withAi = buildTailoredPlan({ programId, answers: NO_ANSWERS, ai: aiResult(programId, NO_ANSWERS), createdAt: NOW });
      expect(withAi.picks).toEqual(fixedPicks(programId));
    });
  }

  it("T-02: cables marked missing: no cable exercise wherever an alternative exists, the rest keep the fixed exercise and are flagged", () => {
    const a = answers({ unavailable: ["cable"] });
    const r = rulesPicks("3-day", a);
    expect(r.keptFixed).toEqual(["A5"]);
    for (const p of r.picks) {
      if (`${p.slotKey}${p.order}` === "A5") expect(p.exerciseId).toBe("triceps_pushdown");
      else expect(exercise(p.exerciseId).equipment).not.toBe("cable");
    }
  });

  it("T-03: an avoided exercise is absent, and only exercises with an alternative can be avoided", () => {
    const r = rulesPicks("3-day", answers({ avoid: ["leg_press"] }));
    expect(idsOf(r.picks)).not.toContain("leg_press");
    expect(r.picks[0]).toMatchObject({ slotKey: "A", order: 1, exerciseId: "goblet_squat" });
    const offered = avoidableExercises("3-day");
    expect(offered).toContain("leg_press");
    expect(offered).not.toContain("leg_extension");
    expect(offered).not.toContain("dumbbell_romanian_deadlift");
  });

  it("T-04: preferring free weights picks a dumbbell option wherever one is allowed, and machines the other way", () => {
    for (const [preference, kinds] of [["free_weights", ["dumbbell", "bodyweight"]], ["machines", ["machine", "cable"]]] as [TailorAnswers["preference"], Equipment[]][]) {
      const a = answers({ preference });
      const r = rulesPicks("3-day", a);
      for (const o of allowedOptions("3-day", a)) {
        const pick = r.picks.find((p) => p.slotKey === o.slotKey && p.order === o.order)!;
        const wanted = o.allowed.some((id) => kinds.includes(exercise(id).equipment as Equipment));
        if (wanted) expect(kinds).toContain(exercise(pick.exerciseId).equipment);
      }
    }
  });

  it("T-05: an AI pick that is not an allowed option rejects all picks", () => {
    const a = answers({ avoid: ["leg_press"] });
    const good = aiResult("3-day", a);
    const bad = { ...good, picks: [...good.picks, { slot_key: "A", order: 1, exercise_id: "leg_press" }] };
    const plan = buildTailoredPlan({ programId: "3-day", answers: a, ai: bad, createdAt: NOW });
    expect(plan.source).toBe("rules");
    expect(idsOf(plan.picks)).not.toContain("leg_press");
    const wrongSlot = aiResult("3-day", NO_ANSWERS, { A1: "lat_pulldown" });
    expect(buildTailoredPlan({ programId: "3-day", answers: NO_ANSWERS, ai: wrongSlot, createdAt: NOW }).source).toBe("rules");
  });

  it("T-06: two picks for one slot, or a missing slot, reject all picks", () => {
    const good = aiResult("3-day", NO_ANSWERS);
    const doubled = { ...good, picks: [...good.picks, good.picks[0]] };
    const missing = { ...good, picks: good.picks.slice(1) };
    for (const ai of [doubled, missing, { picks: "none" }, null]) {
      expect(buildTailoredPlan({ programId: "3-day", answers: NO_ANSWERS, ai, createdAt: NOW }).source).toBe("rules");
    }
    expect(buildTailoredPlan({ programId: "3-day", answers: NO_ANSWERS, ai: good, createdAt: NOW }).source).toBe("ai");
  });

  it("T-07: an AI plan that repeats an exercise within one workout is rejected", () => {
    const dup = aiResult("4-day", NO_ANSWERS, { "U2-2": "chest_supported_row", "U2-3": "chest_supported_row" });
    const plan = buildTailoredPlan({ programId: "4-day", answers: NO_ANSWERS, ai: dup, createdAt: NOW });
    expect(plan.source).toBe("rules");
    for (const p of PROGRAMS["4-day"].slots) {
      const ids = idsOf(plan.picks.filter((x) => x.slotKey === p.key));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("T-07: the rules plan never repeats an exercise in a workout, even when the answers are tight", () => {
    const a = answers({ avoid: ["seated_cable_row", "chest_supported_row"] });
    const r = rulesPicks("4-day", a);
    const u2 = idsOf(r.picks.filter((p) => p.slotKey === "U2"));
    expect(new Set(u2).size).toBe(u2.length);
  });

  it("T-08: a bad explanation is replaced by fixed text and the valid picks stand", () => {
    const bad = [
      "Try 3 sets of leg press.",
      "This avoids knee pain.",
      "Seated Calf Raise builds your calves.",
      Array.from({ length: 70 }, () => "word").join(" "),
      "",
    ];
    for (const text of bad) {
      const plan = buildTailoredPlan({ programId: "3-day", answers: NO_ANSWERS, ai: aiResult("3-day", NO_ANSWERS, {}, text), createdAt: NOW });
      expect(plan.source).toBe("ai");
      expect(plan.explanation).toBe(FIXED_EXPLANATION);
    }
    const ok = buildTailoredPlan({ programId: "3-day", answers: NO_ANSWERS, ai: aiResult("3-day", NO_ANSWERS, {}, "Goblet Squat and Leg Press cover the same job, so we kept the standard choice."), createdAt: NOW });
    expect(ok.explanation).toContain("Goblet Squat");
  });

  it("T-09: with no AI the rules plan follows the answers at once", () => {
    const a = answers({ unavailable: ["machine"], avoid: ["lat_pulldown"] });
    const plan = buildTailoredPlan({ programId: "3-day", answers: a, ai: null, createdAt: NOW });
    expect(plan.source).toBe("rules");
    expect(plan.explanation).toBe(FIXED_EXPLANATION);
    expect(idsOf(plan.picks)).not.toContain("lat_pulldown");
    expect(plan.picks.find((p) => p.slotKey === "A" && p.order === 1)?.exerciseId).toBe("goblet_squat");
  });

  it("T-09: the AI input has only options and the preference, no free text", () => {
    const input = tailorInput("3-day", answers({ preference: "free_weights" }), 3);
    expect(Object.keys(input).sort()).toEqual(["months_training", "preference", "program_days", "slots"]);
    expect(input.slots.every((s) => s.options.length > 1)).toBe(true);
  });

  it("T-14: a stored plan is used only while it still fits the menus", () => {
    const plan = buildTailoredPlan({ programId: "3-day", answers: answers({ preference: "free_weights" }), ai: null, createdAt: NOW });
    expect(isValidTailoredPlan(plan)).toBe(true);
    expect(parseTailoredPlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
    const off = { ...plan, picks: plan.picks.map((p, i) => (i === 0 ? { ...p, exerciseId: "lat_pulldown" } : p)) };
    expect(parseTailoredPlan(off)).toBeNull();
    const twice = { ...plan, picks: plan.picks.map((p) => (p.slotKey === "A" && p.order === 2 ? { ...p, exerciseId: "leg_press" } : p)) };
    expect(parseTailoredPlan(twice)).toBeNull();
    expect(parseTailoredPlan({ programId: "3-day" })).toBeNull();
    expect(parseTailoredPlan(null)).toBeNull();
  });

  it("T-10: every tailored slot keeps its set count, order and exercise class", () => {
    const sets: TailorAnswers[] = [NO_ANSWERS, answers({ preference: "free_weights" }), answers({ unavailable: ["cable"] }), answers({ unavailable: ["machine", "cable"], avoid: ["goblet_squat"] })];
    for (const programId of PROGRAM_IDS) {
      for (const a of sets) {
        const tailored = tailoredProgram(programId, rulesPicks(programId, a).picks);
        PROGRAMS[programId].slots.forEach((slot, si) => {
          slot.exercises.forEach((row, ri) => {
            const t = tailored.slots[si]!.exercises[ri]!;
            expect([t.order, t.sets]).toEqual([row.order, row.sets]);
            expect(exercise(t.exerciseId).type).toBe(exercise(row.exerciseId).type);
            expect(t.swapId).not.toBe(t.exerciseId);
          });
        });
      }
    }
  });

  it("T-11: re-tailoring keeps the history of an exercise that stays and calibrates a new one", () => {
    const fixed = ctxWith("3-day");
    const { state } = runWorkout(EMPTY_STATE, fixed, "2026-10-02", (s) => logAll(logAll(s, 0, [8, 8], "easy"), 0, [8, 8, 8], "good"), "A");
    const picks = rulesPicks("3-day", answers({ avoid: ["machine_chest_press"] })).picks;
    const plan = planWorkout(state, ctxWith("3-day", picks), "A", "2026-10-04");
    expect(plan[0]).toMatchObject({ exerciseId: "leg_press", prescription: { kind: "working", weightG: kg(10), targetReps: 9 } });
    expect(plan[1]).toMatchObject({ exerciseId: "dumbbell_bench_press", prescription: { kind: "calibration" } });
  });

  it("T-12: a finished session replays the same whatever the plan is changed to later", () => {
    const fixed = ctxWith("3-day");
    const done = runWorkout(EMPTY_STATE, fixed, "2026-10-02", (s) => logAll(logAll(s, 0, [8, 8], "easy"), 0, [8, 8, 8], "good"), "A");
    const events: PlanEvent[] = [{ kind: "session", id: done.session.id, at: done.session.startedAt, session: done.session }];
    const before = buildState(events);
    expect(done.session.exercises[0]).toMatchObject({ exerciseId: "leg_press", slotExerciseId: "leg_press", swapExerciseId: "goblet_squat" });
    // A later tailored plan changes nothing already stored.
    rulesPicks("3-day", answers({ preference: "free_weights" }));
    expect(buildState(events)).toEqual(before);
    expect(before).toEqual(done.state);
  });

  it("T-13: pain on a tailored exercise swaps to the plan's swap with the engine's own pain rules", () => {
    const picks = rulesPicks("3-day", answers({ preference: "free_weights" })).picks;
    const ctx = ctxWith("3-day", picks);
    const first = runWorkout(EMPTY_STATE, ctx, "2026-10-02", (s) => logAll(logAll(s, 0, [8, 8], "easy"), 0, [8, 8, 8], "good"), "A");
    expect(first.session.exercises[0]).toMatchObject({ exerciseId: "goblet_squat", swapExerciseId: "leg_press" });
    const plan = planWorkout(first.state, ctx, "A", "2026-10-04");
    let s = startSession(plan, { id: nextId(), programId: "3-day", slotKey: "A", today: "2026-10-04", now: at("2026-10-04"), state: first.state });
    s = logAll(s, 0, [8], "good");
    const r = reportPain(s, 0, first.state, ctx, { pain: { id: nextId(), location: "knee", severity: 3, atRestOrNight: false, numbnessTinglingSwellingInstability: false }, now: at("2026-10-04", 10) });
    expect(r.showProfessionalHelp).toBe(false);
    const after = applySession(first.state, finishSession(r.session, first.state, at("2026-10-04", 11)));
    expect(after.slots["goblet_squat"]!.pain.status).toBe("on_swap");
    expect(planWorkout(after, ctx, "A", "2026-10-06")[0]).toMatchObject({ exerciseId: "leg_press", isSwap: true, slotExerciseId: "goblet_squat", prescription: { kind: "calibration" } });
  });
});
