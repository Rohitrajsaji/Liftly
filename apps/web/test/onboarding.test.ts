import { describe, expect, it } from "vitest";
import { back, changeProgram, clampMonths, furthestAllowed, goTo, isBeyondBeginnerRange, NEW_PROFILE, next, normalize, type Profile } from "../src/onboarding";

const done: Profile = { step: "preview", monthsTraining: 4, programId: "3-day", goalConfirmed: true };

describe("onboarding steps (PRD F1)", () => {
  it("runs welcome → experience → program → goal → preview", () => {
    let p = next(NEW_PROFILE);
    expect(p.step).toBe("experience");
    p = next({ ...p, monthsTraining: 0 });
    expect(p.step).toBe("program");
    p = next({ ...p, programId: "4-day" });
    expect(p.step).toBe("goal");
    p = next({ ...p, goalConfirmed: true });
    expect(p.step).toBe("preview");
  });

  it("cannot pass a step that is not answered", () => {
    const p = next({ ...NEW_PROFILE, step: "experience" });
    expect(p.step).toBe("experience");
    expect(goTo(NEW_PROFILE, "preview").step).toBe("experience");
    expect(furthestAllowed({ ...NEW_PROFILE, monthsTraining: 2, programId: "3-day" })).toBe("goal");
  });

  it("0 months is a valid answer", () => {
    expect(next({ ...NEW_PROFILE, step: "experience", monthsTraining: 0 }).step).toBe("program");
  });

  it("back never goes before welcome and keeps answers", () => {
    expect(back(NEW_PROFILE).step).toBe("welcome");
    expect(back(done)).toEqual({ ...done, step: "goal" });
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
    expect(normalize({ step: "preview", monthsTraining: 3, programId: "3-day", goalConfirmed: false }).step).toBe("goal");
    expect(normalize({ ...done, programId: "5-day" as never }).step).toBe("program");
    expect(normalize({ ...done, step: "nope" as never }).step).toBe("welcome");
    expect(normalize(done)).toEqual(done);
  });
});
