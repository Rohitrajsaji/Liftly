import { describe, expect, it } from "vitest";
import { EMPTY_STATE, history, logSet, personalRecords, sessionsPerWeek, weekStart, weightHistory } from "../src";
import { at, ctxFor, logAll, runWorkout } from "./helpers";

function twoWorkouts() {
  const ctx = ctxFor();
  // Workout A on day 1: calibration, a Good first set ends it, then two more.
  const a = runWorkout(EMPTY_STATE, ctx, "2026-10-05", (s) => logAll(s, 0, [8, 8, 8], "good"));
  const b = runWorkout(a.state, ctx, "2026-10-07", (s) => logAll(s, 0, [8, 8, 8], "good"), "A");
  return [a.session, b.session];
}

describe("progress and history", () => {
  it("weight history has one point per session with working sets, ramp sets left out", () => {
    const sessions = twoWorkouts();
    const h = weightHistory(sessions);
    const first = sessions[0]?.exercises[0]?.exerciseId ?? "";
    expect(h[first]).toHaveLength(2);
    expect(h[first]?.[0]).toMatchObject({ date: "2026-10-05", sets: 3, totalReps: 24 });
  });

  it("records the heaviest weight lifted for at least the bottom of the range, ignoring Failed attempts below it", () => {
    const ctx = ctxFor();
    const a = runWorkout(EMPTY_STATE, ctx, "2026-10-05", (s) => {
      let out = logAll(s, 0, [8, 8, 8], "good");
      // A second exercise: a heavy set far below the bottom of the range does not count.
      out = logSet(out, 1, { reps: 3, effort: "failed", now: at("2026-10-05") });
      return out;
    });
    const prs = personalRecords([a.session]);
    const ids = prs.map((p) => p.exerciseId);
    expect(ids).toContain(a.session.exercises[0]?.exerciseId);
    expect(ids).not.toContain(a.session.exercises[1]?.exerciseId);
  });

  it("counts sessions per week, Monday to Sunday, including empty weeks", () => {
    expect(weekStart("2026-10-08")).toBe("2026-10-05");
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    const weeks = sessionsPerWeek(twoWorkouts(), "2026-10-14", 3);
    expect(weeks.map((w) => w.sessions)).toEqual([0, 2, 0]);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
  });

  it("history is newest first and leaves out skipped exercises", () => {
    const items = history(twoWorkouts());
    expect(items.map((i) => i.date)).toEqual(["2026-10-07", "2026-10-05"]);
    expect(items[0]?.exercises).toHaveLength(1);
  });
});
