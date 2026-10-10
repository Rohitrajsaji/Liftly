import { describe, expect, it } from "vitest";
import { buildDebriefInput, DEBRIEF_FALLBACK, fallbackDebrief, REASON_CODES, validateDebrief, EMPTY_STATE, type DebriefInput } from "../src";
import { ctxFor, logAll, runWorkout } from "./helpers";

function input(): DebriefInput {
  const ctx = ctxFor();
  const a = runWorkout(EMPTY_STATE, ctx, "2026-10-05", (s) => logAll(s, 0, [8, 8, 8], "good"));
  const b = runWorkout(a.state, ctx, "2026-10-07", (s) => logAll(s, 0, [12, 12, 12], "easy"), "A");
  return buildDebriefInput({ session: b.session, sessions: [a.session, b.session], monthsTraining: 3, startDate: "2026-10-01", userId: "u-1" });
}

const good = (i: DebriefInput) => {
  const d = i.decisions[0]!;
  return {
    debrief_text: `You did 3 sets of 12 on ${d.exercise}, all at ${i.today[0]!.sets[0]!.kg} kg. Next time the weight goes to ${d.nextKg} kg because every set hit the top of the range. This is session ${i.profile.sessionNumber} of your plan. Keep resting between sets so each one stays strong.`,
    reason_codes_cited: [d.reasonCode],
    numbers_cited: [3, 12, i.today[0]!.sets[0]!.kg, d.nextKg, i.profile.sessionNumber],
    contains_pain_guidance: false,
    units: "kg" as const,
  };
};

describe("buildDebriefInput", () => {
  it("is pseudonymous and carries the engine's decisions, history and profile", () => {
    const i = input();
    expect(i.userId).toBe("u-1");
    expect(JSON.stringify(i)).not.toMatch(/@/);
    expect(i.profile).toMatchObject({ monthsTraining: 3, programDays: 3, sessionNumber: 2, weekNumber: 2 });
    expect(i.decisions[0]).toMatchObject({ reasonCode: expect.any(String) });
    expect(i.history[0]?.exposures).toHaveLength(1);
    expect(i.userNote).toBeNull();
    expect(i.flags.personalRecords.length).toBeGreaterThan(0);
  });
  it("uses a placeholder id when there is no account", () => {
    const ctx = ctxFor();
    const a = runWorkout(EMPTY_STATE, ctx, "2026-10-05", (s) => logAll(s, 0, [8, 8, 8], "good"));
    expect(buildDebriefInput({ session: a.session, sessions: [a.session], monthsTraining: 0, startDate: "2026-10-05", userId: null }).userId).toBe("anonymous");
  });
});

describe("validateDebrief", () => {
  it("accepts a well formed debrief whose numbers all come from the input", () => {
    const i = input();
    expect(validateDebrief(good(i), i)).toMatchObject({ ok: true });
  });
  const reject = (mutate: (o: ReturnType<typeof good>, i: DebriefInput) => unknown, why: RegExp) => {
    const i = input();
    const r = validateDebrief(mutate(good(i), i), i);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(why);
  };
  it("rejects a weight that is not in the input", () => reject((o) => ({ ...o, debrief_text: o.debrief_text.replace("kg because", "kg (maybe 77 kg) because") }), /number not in input: 77/));
  it("rejects a number listed in numbers_cited that is not in the input", () => reject((o) => ({ ...o, numbers_cited: [...o.numbers_cited, 999] }), /999/));
  it("rejects a reason code that is not in the input", () => reject((o) => ({ ...o, reason_codes_cited: ["RECAL"] }), /reason code/));
  it("rejects a code printed in the text that is not in the input", () => reject((o) => ({ ...o, debrief_text: `${o.debrief_text} RECAL.` }), /reason code/));
  it.each(["Your shoulder pain may be a tendon problem.", "Take a creatine supplement.", "It is fine to push through it.", "That is 25 lbs."])("rejects forbidden wording: %s", (extra) =>
    reject((o) => ({ ...o, debrief_text: o.debrief_text.replace("Keep resting", `${extra} Keep resting`) }), /forbidden|number/));
  it("rejects pain guidance, wrong units, and the wrong length", () => {
    reject((o) => ({ ...o, contains_pain_guidance: true }), /pain/);
    reject((o) => ({ ...o, units: "lb" }), /units/);
    reject((o) => ({ ...o, debrief_text: "Good job." }), /sentences/);
    reject((o) => ({ ...o, debrief_text: o.debrief_text + " One more. And another." }), /sentences/);
    reject((o) => ({ ...o, debrief_text: `${"word ".repeat(100)}one. Two. Three.` }), /too long/);
  });
  it("rejects anything that is not the expected object", () => {
    const i = input();
    for (const bad of [null, "text", 5, {}, { debrief_text: 5 }]) expect(validateDebrief(bad, i).ok).toBe(false);
  });
});

describe("fallbackDebrief", () => {
  it("has fixed text for every reason code, without numbers", () => {
    for (const c of REASON_CODES) expect(DEBRIEF_FALLBACK[c]).toMatch(/^[^\d]+$/);
  });
  it("uses the session's reason codes and no pain wording", () => {
    const text = fallbackDebrief(input());
    expect(text).toMatch(/^Workout saved\./);
    expect(text).not.toMatch(/\d|pain/i);
  });
});
