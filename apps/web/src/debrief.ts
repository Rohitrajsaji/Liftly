// The post-workout debrief on the device (AI_COACH.md sections 7 and 9). The fixed text is saved first, so a finished
// workout always has a debrief. If the user turned Claude summaries on and is signed in, Claude's text replaces it only
// after it passes validation; a failure keeps the fixed text, is logged, and is retried once later.

import { fallbackDebrief, validateDebrief, type DebriefInput, type SessionRecord } from "@liftly/workout";
import { BackendError, type Backend, type ConsentRow, type Session } from "./backend";
import { newId } from "./account";
import type { DebriefRecord, LiftlyDb } from "./db";
import { enqueueConsent, flushOutbox } from "./sync";

/** Separate from the account consent: sending workout data to Claude is optional and off until the user turns it on. */
export const DEBRIEF_CONSENT_VERSION = "ai-debrief-draft-2";

export const DEBRIEF_CONSENT_TITLE = "AI workout summaries";

// DRAFT wording, like consent.ts: not legal advice, and SAFETY.md section 6 still lists a legal review as open.
export const DEBRIEF_CONSENT_POINTS: readonly string[] = [
  "After each workout, an AI model can write a short summary of it. This is optional and off until you turn it on.",
  "To do that, Liftly sends that workout's exercises, weights, reps and effort, your last few sessions, your months of training, and for any pain you reported only the exercise and a mild, moderate or high label. No name, email or phone number is sent.",
  "The model is a free one run by a third party, reached through OpenRouter. Free models may keep what they are sent and may use it to improve themselves, so leave this off if you'd rather your workout details stay private.",
  "The AI only explains. Liftly's own rules decide every weight and rep, and its text is checked before you see it. If it can't be used, a fixed summary is shown instead.",
  "You can turn this off at any time from the Account screen. Turning it off stops new workouts being sent.",
];

export const MAX_ATTEMPTS = 2;
/** Back-off after each rate limit, in seconds. The server's Retry-After wins when it is longer. */
export const BACKOFF_S: readonly number[] = [60, 300, 1800, 7200];
export const MAX_DEFERRALS = BACKOFF_S.length + 2;
const TIMEOUT_MS = 65_000; // the function tries several models for up to ~55 s
const FLAG = "claudeDebrief";

export async function claudeDebriefOn(db: LiftlyDb): Promise<boolean> {
  return (await db.flags.get(FLAG))?.value === DEBRIEF_CONSENT_VERSION;
}

/** Turns Claude summaries on (recording the consent for the account) or off. */
export async function setClaudeDebrief(db: LiftlyDb, backend: Backend, session: Session, on: boolean, now: Date): Promise<void> {
  if (!on) {
    await db.flags.put({ key: FLAG, value: "off" });
    return;
  }
  const row: ConsentRow = { id: newId(), user_id: session.userId, consent_version: DEBRIEF_CONSENT_VERSION, accepted_at: now.toISOString() };
  await enqueueConsent(db, row, now);
  await db.flags.put({ key: FLAG, value: DEBRIEF_CONSENT_VERSION });
  // The server checks this consent before it calls Claude, so upload it now if we can; otherwise it goes up when online.
  await flushOutbox(db, backend, session.userId).catch(() => undefined);
}

/** Saves the fixed debrief for a finished workout if none exists yet. */
export async function ensureDebrief(db: LiftlyDb, session: SessionRecord, input: DebriefInput, now: Date): Promise<DebriefRecord> {
  const have = await db.debriefs.get(session.id);
  if (have !== undefined) return have;
  const rec: DebriefRecord = { sessionId: session.id, text: fallbackDebrief(input), source: "fallback", attempts: 0, lastFailure: null, nextTryAt: null, deferrals: 0, input, updatedAt: now.toISOString() };
  await db.debriefs.put(rec);
  return rec;
}

const withTimeout = <T>(p: Promise<T>): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new BackendError("offline", "Timed out")), TIMEOUT_MS))]);

let queue: Promise<unknown> = Promise.resolve();

/** One request to the AI model for a saved debrief, one at a time so a burst can't trip the rate limit. Never throws. */
export function requestClaudeDebrief(db: LiftlyDb, backend: Backend, sessionId: string, now: Date): Promise<DebriefRecord | null> {
  const run = queue.then(() => requestNow(db, backend, sessionId, now));
  queue = run.catch(() => undefined);
  return run;
}

async function requestNow(db: LiftlyDb, backend: Backend, sessionId: string, now: Date): Promise<DebriefRecord | null> {
  const rec = await db.debriefs.get(sessionId);
  if (rec === undefined || rec.source === "claude" || rec.attempts >= MAX_ATTEMPTS) return rec ?? null;
  const failed = async (reason: string, counts: boolean, nextTryAt: string | null = null, deferred = false): Promise<DebriefRecord> => {
    console.warn(`Liftly debrief: using the fixed text (${reason})`);
    const next: DebriefRecord = {
      ...rec,
      attempts: rec.attempts + (counts ? 1 : 0),
      deferrals: rec.deferrals + (deferred ? 1 : 0),
      lastFailure: reason,
      nextTryAt,
      updatedAt: now.toISOString(),
    };
    await db.debriefs.put(next);
    return next;
  };
  if (rec.nextTryAt !== null && Date.parse(rec.nextTryAt) > now.getTime()) return rec;
  let raw: unknown;
  try {
    raw = await withTimeout(backend.requestDebrief(rec.input));
  } catch (e) {
    const kind = e instanceof BackendError ? e.kind : "other";
    // Offline or not yet allowed: not a failed attempt; try again when back online / after consent.
    if (kind === "offline" || kind === "consent_required") return failed(kind, false);
    // Rate limited: wait longer each time, and give up counting it as free after several tries.
    if (kind === "rate_limited") {
      const wait = Math.max(BACKOFF_S[Math.min(rec.deferrals, BACKOFF_S.length - 1)] ?? 7200, e instanceof BackendError ? (e.retryAfterS ?? 0) : 0);
      const exhausted = rec.deferrals + 1 >= MAX_DEFERRALS;
      return failed(kind, exhausted, new Date(now.getTime() + wait * 1000).toISOString(), true);
    }
    return failed(kind, true);
  }
  const check = validateDebrief(raw, rec.input);
  if (!check.ok) return failed(`validation: ${check.reason}`, true);
  const next: DebriefRecord = { ...rec, text: check.text, source: "claude", lastFailure: null, nextTryAt: null, updatedAt: now.toISOString() };
  await db.debriefs.put(next);
  return next;
}

/** The one retry later: recent fixed debriefs that Claude has not been asked for yet or failed once. */
export async function retryPending(db: LiftlyDb, backend: Backend, now: Date): Promise<string[]> {
  if (!(await claudeDebriefOn(db))) return [];
  const cutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const todo = (await db.debriefs.where("updatedAt").above(cutoff).toArray()).filter((r) => r.source === "fallback" && r.attempts < MAX_ATTEMPTS && (r.nextTryAt === null || Date.parse(r.nextTryAt) <= now.getTime())).slice(-3);
  const changed: string[] = [];
  for (const r of todo) {
    const out = await requestClaudeDebrief(db, backend, r.sessionId, now);
    if (out !== null && (out.source !== r.source || out.attempts !== r.attempts)) changed.push(r.sessionId);
  }
  return changed;
}
