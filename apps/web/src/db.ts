// Local database (IndexedDB via Dexie). Onboarding answers and the upload outbox live here. Nothing is added to the
// outbox before an account exists (DECISIONS C7); at sign-in the local answers are queued and uploaded.

import Dexie, { type EntityTable } from "dexie";
import type { DebriefInput, PlanEvent, SessionRecord } from "@liftly/workout";
import { NEW_PROFILE, normalize, type Profile } from "./onboarding";

interface ProfileRow extends Profile {
  readonly id: "me";
  readonly updatedAt: string;
}

/** A consent the user accepted on this device before an account existed. It is queued for upload at sign-in. */
export interface LocalConsent {
  readonly id: string;
  readonly version: string;
  readonly acceptedAt: string;
}

/** One pending upload (the outbox). Nothing is added before an account exists (DECISIONS C7). */
export interface OutboxItem {
  readonly id: string;
  readonly userId: string;
  readonly table: "profiles" | "consents" | "events" | "ladders";
  readonly row: Record<string, unknown>;
  readonly createdAt: string;
}

/** A finished workout or a pain follow-up answer. Facts only: they are never edited. */
export interface EventRecord {
  readonly id: string;
  readonly kind: PlanEvent["kind"];
  readonly at: string;
  readonly event: PlanEvent;
  /** The account this was queued for, or null while there is no account (DECISIONS C7). */
  readonly queuedFor: string | null;
}

/** The loads the user's gym has for one exercise. */
export interface LadderRecord {
  readonly exerciseId: string;
  readonly loadsG: readonly number[];
  readonly updatedAt: string;
  /** Set on an exercise the user edited on its own, so changing the equipment list does not overwrite it. */
  readonly custom: boolean;
  readonly queuedFor: string | null;
}

/** The workout in progress. There is at most one, and it lives only on this device until it is finished. */
export interface ActiveRecord {
  readonly id: "current";
  readonly session: SessionRecord;
}

/** The debrief shown for one finished workout (AI_COACH.md). Stays on this device. */
export interface DebriefRecord {
  readonly sessionId: string;
  readonly text: string;
  /** "fallback" is the fixed text; "claude" passed validation. */
  readonly source: "fallback" | "claude";
  /** Requests that reached Claude and failed. At most one retry later, so the limit is 2. */
  readonly attempts: number;
  readonly lastFailure: string | null;
  /** Do not ask again before this time (rate limit back-off); null means any time. */
  readonly nextTryAt: string | null;
  /** Times the model was rate limited. Backs off 1, 5, 30 minutes, 2 hours; after MAX_DEFERRALS it counts as a failed attempt. */
  readonly deferrals: number;
  /** The input block, kept so the one retry can run later. */
  readonly input: DebriefInput;
  readonly updatedAt: string;
}

export interface FlagRecord {
  readonly key: string;
  readonly value: string;
}

export class LiftlyDb extends Dexie {
  profile!: EntityTable<ProfileRow, "id">;
  consent!: EntityTable<LocalConsent, "id">;
  outbox!: EntityTable<OutboxItem, "id">;
  events!: EntityTable<EventRecord, "id">;
  ladders!: EntityTable<LadderRecord, "exerciseId">;
  active!: EntityTable<ActiveRecord, "id">;
  debriefs!: EntityTable<DebriefRecord, "sessionId">;
  flags!: EntityTable<FlagRecord, "key">;

  constructor(name = "liftly") {
    super(name);
    this.version(1).stores({ profile: "id" });
    this.version(2).stores({ profile: "id", consent: "id", outbox: "id, userId, createdAt" });
    this.version(3).stores({ profile: "id", consent: "id", outbox: "id, userId, createdAt", events: "id, at, kind", ladders: "exerciseId", active: "id" });
    this.version(4).stores({
      profile: "id",
      consent: "id",
      outbox: "id, userId, createdAt",
      events: "id, at, kind",
      ladders: "exerciseId",
      active: "id",
      debriefs: "sessionId, updatedAt",
      flags: "key",
    });
  }
}

export async function loadProfile(db: LiftlyDb): Promise<Profile> {
  const row = await db.profile.get("me");
  return row === undefined ? NEW_PROFILE : normalize(row);
}

/** The saved profile with the time it last changed, or null when nothing has been saved. */
export async function loadStoredProfile(db: LiftlyDb): Promise<{ readonly profile: Profile; readonly updatedAt: string } | null> {
  const row = await db.profile.get("me");
  return row === undefined ? null : { profile: normalize(row), updatedAt: row.updatedAt };
}

/** Erases everything stored on this device (used when an account is deleted). */
export async function wipeLocalData(db: LiftlyDb): Promise<void> {
  await db.transaction("rw", [db.profile, db.consent, db.outbox, db.events, db.ladders, db.active, db.debriefs, db.flags], async () => {
    await Promise.all([db.profile.clear(), db.consent.clear(), db.outbox.clear(), db.events.clear(), db.ladders.clear(), db.active.clear(), db.debriefs.clear(), db.flags.clear()]);
  });
}

export async function saveProfile(db: LiftlyDb, p: Profile, now: Date = new Date()): Promise<void> {
  await db.profile.put({ ...p, id: "me", updatedAt: now.toISOString() });
}
