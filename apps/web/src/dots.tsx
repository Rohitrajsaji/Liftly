// Small progress visuals. Plain shapes only: a thin bar, a row of dots, a ring.

import { formatClock, type SessionRecord } from "@liftly/workout";
import { useEffect, useState, type ReactNode } from "react";

/** A thin bar. `mark` (0 to 1) draws a tick where the suggested rest begins. */
export function Bar({ value, mark, accent }: { readonly value: number; readonly mark?: number; readonly accent: boolean }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div aria-hidden="true" className="pressed relative h-3 rounded-full">
      <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${accent ? "bg-accent" : "bg-ink"}`} style={{ width: `${pct}%` }} />
      {mark !== undefined && <div className="absolute top-[-3px] h-[18px] w-0.5 bg-ink/50" style={{ left: `${Math.round(mark * 100)}%` }} />}
    </div>
  );
}

/** One dot per exercise of a workout: filled for done. */
export function ProgressDots({ done, total }: { readonly done: number; readonly total: number }) {
  return (
    <span aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`size-3 rounded-full transition-colors duration-500 ${i < done ? "bg-accent" : "pressed"}`} />
      ))}
    </span>
  );
}

/** A ring that fills from 0 to 1, with whatever sits in its middle. */
export function Ring({ value, size = 132, stroke = 10, accent, children }: { readonly value: number; readonly size?: number; readonly stroke?: number; readonly accent: boolean; readonly children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="pressed relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} opacity={0.6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent ? "var(--color-accent)" : "var(--color-ink)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke var(--t-control) var(--ease)" }}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

/** Working sets planned for the workout and how many are logged, ramp sets excluded. */
export function setCounts(session: SessionRecord): { readonly done: number; readonly total: number } {
  let done = 0;
  let total = 0;
  for (const e of session.exercises) {
    if (e.status === "skipped" && e.sets.length === 0) continue;
    const logged = e.sets.filter((s) => s.kind === "working").length;
    // A stopped or ended exercise counts what was done, so the bar can still reach the end.
    const target = e.status === "stopped_pain" || e.status === "done" || e.status === "skipped" ? logged : Math.max(e.targetSets, logged);
    total += target;
    done += Math.min(logged, target);
  }
  return { done, total: Math.max(total, 1) };
}

/** The strip at the top of every workout screen: sets done of planned, and the workout clock. */
export function WorkoutProgress({ session, now }: { readonly session: SessionRecord; readonly now: number }) {
  const { done, total } = setCounts(session);
  const elapsed = Math.max(0, Math.round((now - Date.parse(session.startedAt)) / 1000));
  return (
    <div className="-mt-2 flex flex-col gap-2" data-workout-progress>
      <div className="flex items-baseline justify-between text-sm text-muted">
        <span className="tabular-nums" data-sets-done>
          {done} of {total} sets
        </span>
        <span className="tabular-nums" aria-label="Workout time">
          {formatClock(elapsed)}
        </span>
      </div>
      <Bar value={done / total} accent />
    </div>
  );
}

/** The current time, refreshed every `everyMs`. */
export function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}
