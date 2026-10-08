// Joining an account (DECISIONS C7 and M5 defaults): the answers kept on the device attach at sign-in.

import type { Backend, ConsentRow, ProfileRow, Session } from "./backend";
import { CONSENT_VERSION } from "./consent";
import type { LiftlyDb } from "./db";
import { loadStoredProfile, saveProfile } from "./db";
import { isOnboarded, type Profile } from "./onboarding";
import { enqueueConsent, enqueueProfile, flushOutbox, type FlushResult } from "./sync";
import { pullRemote, queueLocalWork } from "./workoutStore";

/** The profile as the server stores it, or null while any answer is missing. */
export function toProfileRow(p: Profile, userId: string, updatedAt: string): ProfileRow | null {
  if (!isOnboarded(p) || p.monthsTraining === null || p.programId === null || p.startDate === null) return null;
  return { user_id: userId, months_training: p.monthsTraining, program: p.programId, start_date: p.startDate, updated_at: updatedAt };
}

export function fromProfileRow(row: ProfileRow): Profile {
  return { step: "preview", monthsTraining: row.months_training, programId: row.program, startDate: row.start_date };
}

export type Resolution = "push" | "adopt" | "nothing";

/**
 * What to do with the device's answers and the account's profile at sign-in.
 * No account profile: upload the device's (if complete). Device incomplete: use the account's.
 * Both: the newer one wins; equal means they already agree.
 */
export function resolveProfile(local: { readonly profile: Profile; readonly updatedAt: string } | null, server: ProfileRow | null): Resolution {
  const localDone = local !== null && isOnboarded(local.profile);
  if (server === null) return localDone ? "push" : "nothing";
  if (!localDone) return "adopt";
  // Compare instants, not text: the server writes +00:00 where the device writes Z.
  const diff = Date.parse(local.updatedAt) - Date.parse(server.updated_at);
  return diff > 0 ? "push" : diff === 0 ? "nothing" : "adopt";
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Records that the user accepted the consent text, on the device. It uploads at sign-in. */
export async function recordConsent(db: LiftlyDb, now: Date): Promise<void> {
  await db.consent.put({ id: newId(), version: CONSENT_VERSION, acceptedAt: now.toISOString() });
}

export interface AttachResult {
  readonly adopted: Profile | null;
  readonly flush: FlushResult;
}

/** Runs once after a successful sign-in, online. */
export async function attachToAccount(db: LiftlyDb, backend: Backend, session: Session, now: Date): Promise<AttachResult> {
  // Consents accepted on this device belong to the account that just signed in.
  for (const c of await db.consent.toArray()) {
    const row: ConsentRow = { id: c.id, user_id: session.userId, consent_version: c.version, accepted_at: c.acceptedAt };
    await enqueueConsent(db, row, now);
    await db.consent.delete(c.id);
  }

  // Workouts and gym weights made on this device while signed out join the account; the account's come here.
  await queueLocalWork(db, session.userId, now);
  await pullRemote(db, backend, session);

  const local = await loadStoredProfile(db);
  const server = await backend.fetchProfile();
  const action = resolveProfile(local, server);
  let adopted: Profile | null = null;
  if (action === "push" && local !== null) {
    const row = toProfileRow(local.profile, session.userId, local.updatedAt);
    if (row !== null) await enqueueProfile(db, row, now);
  } else if (action === "adopt" && server !== null) {
    adopted = fromProfileRow(server);
    await saveProfile(db, adopted, new Date(server.updated_at));
  }
  return { adopted, flush: await flushOutbox(db, backend, session.userId) };
}

/** After a signed-in user changes their answers: queue the new profile and try to upload it. */
export async function syncProfileChange(db: LiftlyDb, backend: Backend, session: Session, profile: Profile, now: Date): Promise<FlushResult | null> {
  const row = toProfileRow(profile, session.userId, now.toISOString());
  if (row === null) return null;
  await enqueueProfile(db, row, now);
  return flushOutbox(db, backend, session.userId);
}
