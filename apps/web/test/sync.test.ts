// Outbox sync and account attach, against a fake server that keeps rows the way the real one does
// (client-made ids are unique; the profile is one row per user and the newest updated_at wins).
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { attachToAccount, fromProfileRow, recordConsent, resolveProfile, syncProfileChange, toProfileRow } from "../src/account";
import { BackendError, type Backend, type ConsentRow, type EventRow, type LadderRow, type ProfileRow, type Session } from "../src/backend";
import { CONSENT_VERSION } from "../src/consent";
import { LiftlyDb, loadStoredProfile, saveProfile, wipeLocalData } from "../src/db";
import type { Profile } from "../src/onboarding";
import { enqueueConsent, enqueueProfile, flushOutbox, pendingCount } from "../src/sync";

const ALICE: Session = { userId: "u-alice", email: "alice@example.com" };
const BOB: Session = { userId: "u-bob", email: "bob@example.com" };
const T0 = new Date("2026-10-08T10:00:00.000Z");
const T1 = new Date("2026-10-08T11:00:00.000Z");
const T2 = new Date("2026-10-08T12:00:00.000Z");

const onboarded: Profile = { step: "preview", monthsTraining: 3, programId: "3-day", startDate: "2026-10-08" };

class FakeServer implements Backend {
  profiles = new Map<string, ProfileRow>();
  consents = new Map<string, ConsentRow>();
  uploads = 0;
  online = true;
  failAfter: number | null = null;
  user: Session = ALICE;
  private check(): void {
    if (!this.online) throw new BackendError("offline", "No connection");
    if (this.failAfter !== null) {
      if (this.failAfter <= 0) throw new BackendError("offline", "Dropped");
      this.failAfter -= 1;
    }
  }
  async getSession() { return this.user; }
  async signUp() { this.check(); return this.user; }
  async signIn() { this.check(); return this.user; }
  async signOut() {}
  async deleteAccount() {
    this.check();
    this.profiles.delete(this.user.userId);
    for (const [id, c] of this.consents) if (c.user_id === this.user.userId) this.consents.delete(id);
  }
  async pushProfile(row: ProfileRow) {
    this.check();
    this.uploads += 1;
    const old = this.profiles.get(row.user_id);
    if (old === undefined || Date.parse(row.updated_at) >= Date.parse(old.updated_at)) this.profiles.set(row.user_id, row);
  }
  async pushConsent(row: ConsentRow) {
    this.check();
    this.uploads += 1;
    if (!this.consents.has(row.id)) this.consents.set(row.id, row);
  }
  async fetchProfile() {
    this.check();
    return this.profiles.get(this.user.userId) ?? null;
  }
  events = new Map<string, EventRow>();
  ladders = new Map<string, LadderRow>();
  async pushEvent(row: EventRow) {
    this.check();
    this.uploads += 1;
    if (!this.events.has(row.id)) this.events.set(row.id, row);
  }
  async pushLadder(row: LadderRow) {
    this.check();
    this.uploads += 1;
    const key = `${row.user_id}/${row.exercise_id}`;
    const old = this.ladders.get(key);
    if (old === undefined || Date.parse(row.updated_at) >= Date.parse(old.updated_at)) this.ladders.set(key, row);
  }
  async fetchEvents() {
    this.check();
    return [...this.events.values()].filter((e) => e.user_id === this.user.userId);
  }
  async requestDebrief(): Promise<unknown> {
    this.check();
    return {};
  }
  async fetchLadders() {
    this.check();
    return [...this.ladders.values()].filter((l) => l.user_id === this.user.userId);
  }
}

let db: LiftlyDb;
let server: FakeServer;
beforeEach(() => {
  db = new LiftlyDb(`sync-${Math.random()}`);
  server = new FakeServer();
});

const row = (s: Session, over: Partial<ProfileRow> = {}): ProfileRow => ({ user_id: s.userId, months_training: 3, program: "3-day", start_date: "2026-10-08", updated_at: T0.toISOString(), ...over });

describe("O-03 outbox: reconnect after an offline session syncs with no duplicates", () => {
  it("keeps items while offline, uploads them on reconnect, and empties the queue", async () => {
    await enqueueConsent(db, { id: "c1", user_id: ALICE.userId, consent_version: "v", accepted_at: T0.toISOString() }, T0);
    await enqueueProfile(db, row(ALICE), T1);
    server.online = false;
    const failed = await flushOutbox(db, server, ALICE.userId);
    expect(failed.error?.kind).toBe("offline");
    expect(failed.sent).toBe(0);
    expect(await pendingCount(db, ALICE.userId)).toBe(2);
    expect(server.consents.size + server.profiles.size).toBe(0);

    server.online = true;
    const ok = await flushOutbox(db, server, ALICE.userId);
    expect(ok).toEqual({ sent: 2, pending: 0, error: null });
    expect(server.consents.size).toBe(1);
    expect(server.profiles.size).toBe(1);
  });

  it("a connection that drops half way resumes where it stopped, and a second run adds nothing new", async () => {
    await enqueueConsent(db, { id: "c1", user_id: ALICE.userId, consent_version: "v", accepted_at: T0.toISOString() }, T0);
    await enqueueProfile(db, row(ALICE), T1);
    server.failAfter = 1;
    const partial = await flushOutbox(db, server, ALICE.userId);
    expect(partial.sent).toBe(1);
    expect(partial.pending).toBe(1);
    server.failAfter = null;
    await flushOutbox(db, server, ALICE.userId);
    await flushOutbox(db, server, ALICE.userId);
    expect(server.consents.size).toBe(1);
    expect(server.profiles.size).toBe(1);
    expect(server.uploads).toBe(2);
  });

  it("a retry of an upload the server already has (the answer was lost) creates no duplicate", async () => {
    const c: ConsentRow = { id: "c1", user_id: ALICE.userId, consent_version: "v", accepted_at: T0.toISOString() };
    await server.pushConsent(c);
    await enqueueConsent(db, c, T0);
    await enqueueConsent(db, c, T1);
    await flushOutbox(db, server, ALICE.userId);
    expect(server.consents.size).toBe(1);
  });

  it("several unsent profile edits collapse to the latest one", async () => {
    await enqueueProfile(db, row(ALICE, { months_training: 3 }), T0);
    await enqueueProfile(db, row(ALICE, { months_training: 5, updated_at: T1.toISOString() }), T1);
    expect(await pendingCount(db, ALICE.userId)).toBe(1);
    await flushOutbox(db, server, ALICE.userId);
    expect(server.profiles.get(ALICE.userId)?.months_training).toBe(5);
  });

  it("two flushes started at once upload once", async () => {
    await enqueueProfile(db, row(ALICE), T0);
    await Promise.all([flushOutbox(db, server, ALICE.userId), flushOutbox(db, server, ALICE.userId)]);
    expect(server.uploads).toBe(1);
  });

  it("another user's items on the same phone are never uploaded", async () => {
    await enqueueProfile(db, row(BOB), T0);
    await flushOutbox(db, server, ALICE.userId);
    expect(server.profiles.size).toBe(0);
    expect(await pendingCount(db, BOB.userId)).toBe(1);
  });
});

describe("resolveProfile at sign-in", () => {
  const local = (p: Profile, updatedAt: Date) => ({ profile: p, updatedAt: updatedAt.toISOString() });
  it("no account profile: upload the device's if complete, otherwise nothing", () => {
    expect(resolveProfile(local(onboarded, T0), null)).toBe("push");
    expect(resolveProfile(local({ ...onboarded, startDate: null }, T0), null)).toBe("nothing");
    expect(resolveProfile(null, null)).toBe("nothing");
  });
  it("device has no answers: use the account's", () => {
    expect(resolveProfile(null, row(ALICE))).toBe("adopt");
  });
  it("both: the newer one wins, and the server's +00:00 form compares correctly", () => {
    expect(resolveProfile(local(onboarded, T2), row(ALICE, { updated_at: "2026-10-08T11:00:00+00:00" }))).toBe("push");
    expect(resolveProfile(local(onboarded, T0), row(ALICE, { updated_at: "2026-10-08T11:00:00+00:00" }))).toBe("adopt");
    expect(resolveProfile(local(onboarded, T1), row(ALICE, { updated_at: "2026-10-08T11:00:00+00:00" }))).toBe("nothing");
  });
});

describe("attachToAccount (DECISIONS C7: nothing uploads before the account exists)", () => {
  it("before sign-in nothing is queued, even after onboarding and consent", async () => {
    await saveProfile(db, onboarded, T0);
    await recordConsent(db, T0);
    expect(await db.outbox.count()).toBe(0);
    expect(server.uploads).toBe(0);
  });

  it("at sign-in the device's answers and consent upload to the new account", async () => {
    await saveProfile(db, onboarded, T0);
    await recordConsent(db, T0);
    const r = await attachToAccount(db, server, ALICE, T1);
    expect(r.adopted).toBeNull();
    expect(r.flush.error).toBeNull();
    expect(server.profiles.get(ALICE.userId)).toEqual({ user_id: ALICE.userId, months_training: 3, program: "3-day", start_date: "2026-10-08", updated_at: T0.toISOString() });
    const consents = [...server.consents.values()];
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({ user_id: ALICE.userId, consent_version: CONSENT_VERSION, accepted_at: T0.toISOString() });
    expect(await db.consent.count()).toBe(0);
  });

  it("a new device with no answers adopts the account's profile and shows the plan", async () => {
    server.profiles.set(ALICE.userId, row(ALICE, { program: "4-day", months_training: 6 }));
    const r = await attachToAccount(db, server, ALICE, T1);
    expect(r.adopted).toEqual({ step: "preview", monthsTraining: 6, programId: "4-day", startDate: "2026-10-08" });
    expect((await loadStoredProfile(db))?.profile.programId).toBe("4-day");
    expect(server.uploads).toBe(0);
  });

  it("the same sign-in twice does not duplicate anything", async () => {
    await saveProfile(db, onboarded, T0);
    await recordConsent(db, T0);
    await attachToAccount(db, server, ALICE, T1);
    await attachToAccount(db, server, ALICE, T2);
    expect(server.profiles.size).toBe(1);
    expect(server.consents.size).toBe(1);
  });

  it("answers changed while signed in are queued and uploaded; offline they wait", async () => {
    server.online = false;
    const changed: Profile = { ...onboarded, programId: "4-day" };
    const r = await syncProfileChange(db, server, ALICE, changed, T2);
    expect(r?.error?.kind).toBe("offline");
    expect(await pendingCount(db, ALICE.userId)).toBe(1);
    server.online = true;
    await flushOutbox(db, server, ALICE.userId);
    expect(server.profiles.get(ALICE.userId)?.program).toBe("4-day");
  });

  it("an incomplete profile is never queued", async () => {
    expect(toProfileRow({ ...onboarded, startDate: null }, ALICE.userId, T0.toISOString())).toBeNull();
    expect(await syncProfileChange(db, server, ALICE, { ...onboarded, programId: null }, T0)).toBeNull();
    expect(await db.outbox.count()).toBe(0);
  });

  it("round trip: profile to row and back", () => {
    const r = toProfileRow(onboarded, ALICE.userId, T0.toISOString());
    expect(r && fromProfileRow(r)).toEqual(onboarded);
  });
});

describe("wiping the device after account deletion", () => {
  it("clears answers, consents and the outbox", async () => {
    await saveProfile(db, onboarded, T0);
    await recordConsent(db, T0);
    await enqueueProfile(db, row(ALICE), T0);
    await wipeLocalData(db);
    expect(await db.profile.count() + (await db.consent.count()) + (await db.outbox.count())).toBe(0);
  });
});
