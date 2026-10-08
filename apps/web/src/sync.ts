// Outbox sync (PRD FR-15, TESTING O-03). Writes go to the device first; this uploads them when there is a connection.
// Every upload is idempotent (client-made ids; newest profile wins on the server), so a retry after a dropped
// connection never creates a duplicate. Items go oldest first and a failure stops the run, so order is kept.

import type { Backend, ConsentRow, ProfileRow } from "./backend";
import { BackendError } from "./backend";
import type { LiftlyDb, OutboxItem } from "./db";

export function profileOutboxId(userId: string): string {
  return `profiles:${userId}`;
}

/** Queues the profile. Only the latest version per user is kept: it replaces an earlier unsent one. */
export async function enqueueProfile(db: LiftlyDb, row: ProfileRow, now: Date): Promise<void> {
  await db.outbox.put({ id: profileOutboxId(row.user_id), userId: row.user_id, table: "profiles", row: { ...row }, createdAt: now.toISOString() });
}

/** Queues a consent. Its id is the primary key, so queueing it twice is one upload. */
export async function enqueueConsent(db: LiftlyDb, row: ConsentRow, now: Date): Promise<void> {
  await db.outbox.put({ id: `consents:${row.id}`, userId: row.user_id, table: "consents", row: { ...row }, createdAt: now.toISOString() });
}

export async function pendingCount(db: LiftlyDb, userId: string): Promise<number> {
  return db.outbox.where("userId").equals(userId).count();
}

export interface FlushResult {
  readonly sent: number;
  readonly pending: number;
  readonly error: BackendError | null;
}

/** Flushes for one database run one after another, never overlapping, so no run can miss what another queued. */
const tail = new WeakMap<LiftlyDb, Promise<unknown>>();

/** Uploads this user's pending items. Another user's items on the same phone are left alone. */
export function flushOutbox(db: LiftlyDb, backend: Backend, userId: string): Promise<FlushResult> {
  const run = (tail.get(db) ?? Promise.resolve()).then(() => doFlush(db, backend, userId));
  tail.set(db, run.catch(() => undefined));
  return run;
}

async function push(backend: Backend, item: OutboxItem): Promise<void> {
  if (item.table === "profiles") return backend.pushProfile(item.row as unknown as ProfileRow);
  return backend.pushConsent(item.row as unknown as ConsentRow);
}

async function doFlush(db: LiftlyDb, backend: Backend, userId: string): Promise<FlushResult> {
  const items = (await db.outbox.where("userId").equals(userId).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  let sent = 0;
  for (const item of items) {
    try {
      await push(backend, item);
    } catch (e) {
      const error = e instanceof BackendError ? e : new BackendError("other", e instanceof Error ? e.message : "Upload failed");
      return { sent, pending: items.length - sent, error };
    }
    // Remove only if it was not replaced while uploading (a newer profile keeps its place in the queue).
    const current = await db.outbox.get(item.id);
    if (current !== undefined && current.createdAt === item.createdAt) await db.outbox.delete(item.id);
    sent += 1;
  }
  return { sent, pending: await pendingCount(db, userId), error: null };
}
