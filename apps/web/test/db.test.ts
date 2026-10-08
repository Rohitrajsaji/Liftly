import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { LiftlyDb, loadProfile, saveProfile } from "../src/db";
import { NEW_PROFILE, type Profile } from "../src/onboarding";

describe("local profile storage", () => {
  it("starts empty and keeps answers across database reopen", async () => {
    const name = `t-${Math.random()}`;
    const db = new LiftlyDb(name);
    expect(await loadProfile(db)).toEqual(NEW_PROFILE);
    const p: Profile = { step: "preview", monthsTraining: 7, programId: "4-day", startDate: "2026-10-08" };
    await saveProfile(db, p, new Date("2026-10-08T00:00:00Z"));
    db.close();
    const again = new LiftlyDb(name);
    expect(await loadProfile(again)).toEqual(p);
    expect((await again.profile.get("me"))?.updatedAt).toBe("2026-10-08T00:00:00.000Z");
  });
});
