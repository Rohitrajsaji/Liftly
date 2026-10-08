import { describe, expect, it } from "vitest";
import { isOnboarded, localDate, stampStartDate, back, changeProgram, clampMonths, furthestAllowed, goTo, isBeyondBeginnerRange, NEW_PROFILE, next, normalize, type Profile } from "../src/onboarding";

const done: Profile = { step: "preview", monthsTraining: 4, programId: "3-day", startDate: "2026-10-08" };

describe("onboarding steps (PRD F1)", () => {
  it("runs welcome → experience → program → preview (no goal step)", () => {
    let p = next(NEW_PROFILE);
    expect(p.step).toBe("experience");
    p = next({ ...p, monthsTraining: 0 });
    expect(p.step).toBe("program");
    p = next({ ...p, programId: "4-day", startDate: "2026-10-08" });
    expect(p.step).toBe("preview");
  });

  it("cannot pass a step that is not answered", () => {
    const p = next({ ...NEW_PROFILE, step: "experience" });
    expect(p.step).toBe("experience");
    expect(goTo(NEW_PROFILE, "preview").step).toBe("experience");
    expect(furthestAllowed({ ...NEW_PROFILE, monthsTraining: 2, programId: "3-day" })).toBe("preview");
  });

  it("0 months is a valid answer", () => {
    expect(next({ ...NEW_PROFILE, step: "experience", monthsTraining: 0 }).step).toBe("program");
  });

  it("back never goes before welcome and keeps answers", () => {
    expect(back(NEW_PROFILE).step).toBe("welcome");
    expect(back(done)).toEqual({ ...done, step: "program" });
  });

  it("changing program from the preview reopens the program step and keeps the other answers", () => {
    expect(changeProgram(done)).toEqual({ ...done, step: "program" });
  });

  it("months are clamped to whole numbers in range; over 12 is flagged but allowed", () => {
    expect(clampMonths(-3)).toBe(0);
    expect(clampMonths(2.6)).toBe(3);
    expect(clampMonths(500)).toBe(60);
    expect(isBeyondBeginnerRange(12)).toBe(false);
    expect(isBeyondBeginnerRange(13)).toBe(true);
  });

  it("normalize repairs a damaged stored profile", () => {
    expect(normalize(undefined)).toEqual(NEW_PROFILE);
    expect(normalize({ step: "preview", monthsTraining: 3, programId: null }).step).toBe("program");
    // A profile saved by M4, when "goal" was a step, goes straight to the preview.
    expect(normalize({ step: "goal" as never, monthsTraining: 3, programId: "3-day", goalConfirmed: true } as never)).toEqual({ step: "preview", monthsTraining: 3, programId: "3-day", startDate: null });
    expect(normalize({ ...done, programId: "5-day" as never }).step).toBe("program");
    expect(normalize({ ...done, step: "nope" as never }).step).toBe("welcome");
    expect(normalize(done)).toEqual(done);
  });

  it("the start date is set once, the first time the plan is shown, in local time", () => {
    const before: Profile = { step: "program", monthsTraining: 2, programId: "3-day", startDate: null };
    expect(stampStartDate(before, new Date(2026, 9, 8, 23, 59))).toBe(before);
    const shown = stampStartDate({ ...before, step: "preview" }, new Date(2026, 9, 8, 23, 59));
    expect(shown.startDate).toBe("2026-10-08");
    expect(stampStartDate(shown, new Date(2026, 10, 1)).startDate).toBe("2026-10-08");
    expect(localDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("a profile is onboarded only with months, program and start date", () => {
    expect(isOnboarded(done)).toBe(true);
    expect(isOnboarded({ ...done, startDate: null })).toBe(false);
    expect(isOnboarded(NEW_PROFILE)).toBe(false);
  });
});
