// Local database (IndexedDB via Dexie). Everything in M4 stays on the device: nothing is uploaded
// before an account exists (DECISIONS C7). Accounts and the sync outbox arrive in M5.

import Dexie, { type EntityTable } from "dexie";
import { NEW_PROFILE, normalize, type Profile } from "./onboarding";

interface ProfileRow extends Profile {
  readonly id: "me";
  readonly updatedAt: string;
}

export class LiftlyDb extends Dexie {
  profile!: EntityTable<ProfileRow, "id">;

  constructor(name = "liftly") {
    super(name);
    this.version(1).stores({ profile: "id" });
  }
}

export async function loadProfile(db: LiftlyDb): Promise<Profile> {
  const row = await db.profile.get("me");
  return row === undefined ? NEW_PROFILE : normalize(row);
}

export async function saveProfile(db: LiftlyDb, p: Profile, now: Date = new Date()): Promise<void> {
  await db.profile.put({ ...p, id: "me", updatedAt: now.toISOString() });
}
