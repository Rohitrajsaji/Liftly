// Keeps the debrief of each finished workout up to date on screen: saves the fixed text at once, asks Claude when the
// user turned that on, and retries once later (on start, when back online, or when summaries are turned on).

import { useCallback, useEffect, useRef, useState } from "react";
import { buildDebriefInput, type SessionRecord } from "@liftly/workout";
import type { Backend, Session } from "./backend";
import { claudeDebriefOn, ensureDebrief, MAX_ATTEMPTS, requestClaudeDebrief, retryPending } from "./debrief";
import type { DebriefRecord, LiftlyDb } from "./db";
import type { Profile } from "./onboarding";

export interface Debriefs {
  readonly records: Readonly<Record<string, DebriefRecord>>;
  /** Session ids waiting on Claude right now. */
  readonly waiting: ReadonlySet<string>;
  /** Re-read after the setting or the account changed. */
  refresh(): Promise<void>;
}

export function useDebriefs(db: LiftlyDb, backend: Backend | null, session: Session | null, profile: Profile, sessions: readonly SessionRecord[], finished: SessionRecord | null, online: boolean): Debriefs {
  const [records, setRecords] = useState<Record<string, DebriefRecord>>({});
  const [waiting, setWaiting] = useState<ReadonlySet<string>>(new Set());
  const running = useRef(new Set<string>());

  const load = useCallback(async () => {
    const all = await db.debriefs.toArray();
    setRecords(Object.fromEntries(all.map((r) => [r.sessionId, r])));
  }, [db]);

  const ask = useCallback(
    async (id: string) => {
      if (backend === null || session === null || running.current.has(id) || !(await claudeDebriefOn(db))) return;
      running.current.add(id);
      setWaiting((w) => new Set(w).add(id));
      try {
        await requestClaudeDebrief(db, backend, id, new Date());
      } finally {
        running.current.delete(id);
        setWaiting((w) => {
          const n = new Set(w);
          n.delete(id);
          return n;
        });
        await load();
      }
    },
    [db, backend, session, load],
  );

  // A workout just finished: save the fixed text, then ask Claude.
  const lastFinished = useRef<string | null>(null);
  useEffect(() => {
    if (finished === null || lastFinished.current === finished.id || profile.monthsTraining === null || profile.startDate === null) return;
    if (!sessions.some((s) => s.id === finished.id)) return;
    lastFinished.current = finished.id;
    void (async () => {
      const input = buildDebriefInput({ session: finished, sessions, monthsTraining: profile.monthsTraining ?? 0, startDate: profile.startDate ?? finished.date, userId: session?.userId ?? null });
      await ensureDebrief(db, finished, input, new Date());
      await load();
      await ask(finished.id);
    })();
  }, [finished, sessions, profile.monthsTraining, profile.startDate, session, db, load, ask]);

  // Start-up, back online, signed in: the one retry later.
  useEffect(() => {
    void (async () => {
      await load();
      if (backend === null || session === null || !online) return;
      const changed = await retryPending(db, backend, new Date());
      if (changed.length > 0) await load();
    })();
  }, [db, backend, session, online, load]);

  // Rate limited earlier: try again when the back-off ends, while the app is open.
  useEffect(() => {
    if (backend === null || session === null || !online) return;
    const now = Date.now();
    const due = Object.values(records)
      .filter((r) => r.source === "fallback" && r.attempts < MAX_ATTEMPTS && r.nextTryAt !== null)
      .map((r) => Date.parse(r.nextTryAt ?? ""))
      .filter((t) => Number.isFinite(t));
    if (due.length === 0) return;
    const wait = Math.min(Math.max(Math.min(...due) - now, 1000) + 500, 3_600_000);
    const t = setTimeout(() => {
      void retryPending(db, backend, new Date()).then(load);
    }, wait);
    return () => clearTimeout(t);
  }, [records, db, backend, session, online, load]);

  return { records, waiting, refresh: load };
}
