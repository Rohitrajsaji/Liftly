import { describe, expect, it } from "vitest";
import { EMPTY_STATE, newRecords, recordHistory, sessionStats, setsByGroup, trainingCalendar, weekCompare, weekStreak } from "../src";
import { ctxFor, logAll, runWorkout } from "./helpers";

// Three Workout A sessions of the first exercise: calibration, then the same weight with more reps, then more again.
function series() {
  const ctx = ctxFor();
  const a = runWorkout(EMPTY_STATE, ctx, "2026-10-05", (s) => logAll(s, 0, [8, 8, 8], "good"), "A");
  const b = runWorkout(a.state, ctx, "2026-10-07", (s) => logAll(s, 0, [9, 9, 9], "good"), "A");
  const c = runWorkout(b.state, ctx, "2026-10-14", (s) => logAll(s, 0, [10, 10, 9], "good"), "A");
  return [a.session, b.session, c.session];
}

describe("insights", () => {
  it("session stats count working sets, reps, weight × reps and minutes", () => {
    const [a] = series();
    const st = sessionStats(a!);
    expect(st).toMatchObject({ sets: 3, reps: 24, minutes: 60 });
    expect(st.volumeG).toBe(a!.exercises[0]!.sets.filter((s) => s.kind === "working").reduce((n, s) => n + s.weightG * s.reps, 0));
  });

  it("a first session sets no new records; beating the earlier best does", () => {
    const all = series();
    expect(newRecords(all.slice(0, 1), all[0]!)).toEqual([]);
    expect(newRecords(all.slice(0, 2), all[1]!).map((r) => r.reps)).toEqual([9]);
    expect(recordHistory(all).map((r) => r.date)).toEqual(["2026-10-14", "2026-10-07"]);
  });

  it("compares this week with last week and counts streak weeks", () => {
    const all = series();
    const { thisWeek, lastWeek } = weekCompare(all, "2026-10-15");
    expect(thisWeek.workouts).toBe(1);
    expect(lastWeek.workouts).toBe(2);
    expect(weekStreak(all, "2026-10-15", 2)).toBe(1); // last week hit 2; this week not yet
    expect(weekStreak(all, "2026-10-15", 1)).toBe(2);
    expect(weekStreak(all, "2026-10-29", 1)).toBe(0);
  });

  it("marks trained days in a Monday-aligned calendar and groups sets for the week", () => {
    const all = series();
    const cal = trainingCalendar(all, "2026-10-15", 2);
    expect(cal.map((w) => w.weekStart)).toEqual(["2026-10-05", "2026-10-12"]);
    expect(cal[0]!.days).toEqual([true, false, true, false, false, false, false]);
    expect(setsByGroup(all, "2026-10-08", () => "legs")).toEqual({ legs: 6 });
  });
});
