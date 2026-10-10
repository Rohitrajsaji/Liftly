// History (PRD screen 11): finished workouts, newest first, with every set.

import { slot, type SlotKey } from "@liftly/catalog";
import { formatKg, history, type SessionRecord } from "@liftly/workout";
import type { DebriefRecord } from "../db";
import { exerciseName } from "../gym";
import { Screen } from "../ui";

const longDate = (d: string): string => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

export function History({ sessions, programId, debriefs, onRetry }: { readonly sessions: readonly SessionRecord[]; readonly programId: "3-day" | "4-day"; readonly debriefs: Readonly<Record<string, DebriefRecord>>; readonly onRetry?: ((sessionId: string) => void) | undefined }) {
  const items = history(sessions);
  const nameOf = (k: string): string => {
    try {
      return slot(programId, k as SlotKey).name;
    } catch {
      return `Workout ${k}`;
    }
  };
  if (items.length === 0) {
    return (
      <Screen title="History">
        <p className="text-base text-muted" data-empty>
          No workouts yet. Finished workouts show up here with every set.
        </p>
      </Screen>
    );
  }
  return (
    <Screen title="History">
      <ol className="stagger flex flex-col gap-4" aria-label="Workouts" data-history>
        {items.map((it) => (
          <li key={it.id} className="card p-4" data-history-item>
            <details>
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span className="block text-base font-medium">{nameOf(it.slotKey)}</span>
                  <span className="text-sm text-muted">{longDate(it.date)}</span>
                </span>
                <span className="text-sm text-muted">{it.completion === "full" ? "Complete" : "Partial"}</span>
              </summary>
              {debriefs[it.id] !== undefined && (
                <div className="mt-3">
                  <p className="text-sm text-muted" data-history-debrief>
                    {debriefs[it.id]?.text}
                  </p>
                  {onRetry !== undefined && debriefs[it.id]?.source === "fallback" && (
                    <button type="button" onClick={() => onRetry(it.id)} className="min-h-12 rounded-xl text-sm font-medium text-accent underline" data-history-retry>
                      Write the AI summary
                    </button>
                  )}
                </div>
              )}
              <ul className="mt-3 divide-y divide-line">
                {it.exercises.map((e) => (
                  <li key={e.exerciseId} className="py-3">
                    <p className="text-base font-medium">{exerciseName(e.exerciseId)}</p>
                    {e.status === "stopped_pain" && <p className="text-sm text-muted">Stopped for pain</p>}
                    <p className="text-sm tabular-nums text-muted">
                      {e.sets.length === 0 ? "No sets logged" : e.sets.map((s) => `${s.kind === "ramp" ? "warm-up " : ""}${formatKg(s.weightG)} kg × ${s.reps}`).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </Screen>
  );
}
