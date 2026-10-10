// Progress (PRD F14): answers first, raw charts second. This week against last week, the weekly streak and a 12-week
// calendar, a strength trend per exercise, sets per muscle group, records, and what the engine set for next time.
// Everything is read from the finished workouts on the device, so it works offline; nothing here decides a number.

import { PROGRAMS, type ProgramId } from "@liftly/catalog";
import { REP_RANGES } from "@liftly/engine";
import {
  formatKg,
  personalRecords,
  REASON_LINES,
  recordHistory,
  setsByGroup,
  trainingCalendar,
  weekCompare,
  weekStreak,
  weightHistory,
  type PlannedExercise,
  type SessionRecord,
  type WeightPoint,
} from "@liftly/workout";
import { useEffect, useRef, useState } from "react";
import { Ring } from "../dots";
import { exerciseName } from "../gym";
import { MUSCLE_GROUPS, muscleOf } from "../muscles";
import { localDate } from "../onboarding";
import { Screen } from "../ui";

export const shortDate = (d: string): string => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
};

const ago = (d: string, today: string): string => {
  const days = Math.round((Date.parse(today) - Date.parse(d)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? `${days} days ago` : shortDate(d);
};

export function Progress({ sessions, programId, plan, today = localDate(new Date()) }: { readonly sessions: readonly SessionRecord[]; readonly programId: ProgramId; readonly plan: readonly PlannedExercise[] | null; readonly today?: string }) {
  const history = weightHistory(sessions);
  const ids = Object.keys(history).sort((a, b) => (history[b]?.length ?? 0) - (history[a]?.length ?? 0));
  const [picked, setPicked] = useState<string | null>(null);
  const current = picked !== null && ids.includes(picked) ? picked : (ids[0] ?? null);

  if (sessions.length === 0) {
    return (
      <Screen title="Progress">
        <p className="text-base text-muted" data-empty>
          Nothing to show yet. Finish your first workout and your week, records and strength trends will appear here.
        </p>
      </Screen>
    );
  }

  const perWeek = PROGRAMS[programId].sessionsPerWeek;
  const { thisWeek, lastWeek } = weekCompare(sessions, today);
  const streak = weekStreak(sessions, today, perWeek);
  const calendar = trainingCalendar(sessions, today, 12);
  const groups = setsByGroup(sessions, today, muscleOf);
  const maxGroup = Math.max(1, ...Object.values(groups));
  const feed = recordHistory(sessions).slice(0, 5);
  const best = personalRecords(sessions);
  const coming = (plan ?? []).filter((p) => p.prescription?.kind === "working");

  return (
    <Screen title="Progress">
      <section className="card p-5" aria-label="This week" data-this-week>
        <p className="eyebrow">This week</p>
        <div className="mt-3 flex items-center gap-5">
          <Ring value={thisWeek.workouts / perWeek} accent size={108} stroke={9}>
            <p className="text-2xl font-semibold tabular-nums">
              <CountUp value={thisWeek.workouts} />/{perWeek}
            </p>
            <p className="text-xs text-muted">workouts</p>
          </Ring>
          <dl className="grid flex-1 grid-cols-1 gap-2">
            <Delta label="Sets" now={thisWeek.sets} before={lastWeek.sets} />
            <Delta label="Reps" now={thisWeek.reps} before={lastWeek.reps} />
            <Delta label="Minutes" now={thisWeek.minutes} before={lastWeek.minutes} />
          </dl>
        </div>
      </section>

      <section className="card p-5" aria-label="Consistency" data-consistency>
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">Consistency</p>
          <p className="text-sm text-muted" data-streak>
            {streak === 0 ? `Aim for ${perWeek} a week` : `${streak} ${streak === 1 ? "week" : "weeks"} on plan`}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-12 gap-1.5" role="img" aria-label={`Training days over the last 12 weeks: ${sessions.length} workouts`} data-calendar>
          {calendar.map((w) => (
            <div key={w.weekStart} className="grid grid-rows-7 gap-1.5" data-week>
              {w.days.map((on, d) => (
                <span key={d} className={`aspect-square rounded-[4px] transition-colors duration-500 ${on ? "bg-accent" : "pressed"}`} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{shortDate(calendar[0]?.weekStart ?? today)}</span>
          <span>This week</span>
        </div>
      </section>

      <section className="card p-5" aria-label="Strength trend" data-weight-chart>
        <p className="eyebrow">Strength trend</p>
        <ul className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2" aria-label="Exercise">
          {ids.map((id) => (
            <li key={id} className="shrink-0">
              <button type="button" aria-pressed={id === current} onClick={() => setPicked(id)} className={`min-h-12 whitespace-nowrap rounded-full px-4 text-sm ${id === current ? "pressed font-medium text-accent" : "raised"}`}>
                {exerciseName(id)}
              </button>
            </li>
          ))}
        </ul>
        {current !== null && <TrendChart key={current} name={exerciseName(current)} points={history[current] ?? []} />}
      </section>

      <section className="card p-5" aria-label="Sets by muscle this week" data-muscles>
        <p className="eyebrow">Sets by muscle this week</p>
        {Object.keys(groups).length === 0 ? (
          <p className="mt-2 text-sm text-muted">No sets yet this week.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {MUSCLE_GROUPS.filter((g) => (groups[g] ?? 0) > 0).map((g) => (
              <li key={g} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-sm">
                <span>{g}</span>
                <span className="pressed h-3 overflow-hidden rounded-full">
                  <span className="grow-x block h-full rounded-full bg-accent" style={{ width: `${((groups[g] ?? 0) / maxGroup) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{groups[g]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-label="Personal records" data-records>
        <p className="eyebrow">Records</p>
        {feed.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1" data-record-feed>
            {feed.map((r) => (
              <li key={`${r.exerciseId}-${r.date}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium text-accent">New</span> {exerciseName(r.exerciseId)}
                </span>
                <span className="text-muted">{ago(r.date, today)}</span>
              </li>
            ))}
          </ul>
        )}
        <ul className={`divide-y divide-line ${feed.length > 0 ? "mt-3 border-t border-line" : "mt-1"}`}>
          {best.map((r) => (
            <li key={r.exerciseId} className="flex items-baseline justify-between gap-3 py-3" data-record>
              <span>
                <span className="block text-base font-medium">{exerciseName(r.exerciseId)}</span>
                <span className="text-sm text-muted">Best set · {shortDate(r.date)}</span>
              </span>
              <span className="text-base tabular-nums">
                {formatKg(r.weightG)} kg × {r.reps}
              </span>
            </li>
          ))}
          {best.length === 0 && <li className="py-3 text-sm text-muted">A record needs a set at your target reps or more.</li>}
        </ul>
      </section>

      {coming.length > 0 && (
        <section className="card p-5" aria-label="Coming up next workout" data-coming-up>
          <p className="eyebrow">Coming up next workout</p>
          <ul className="mt-1 divide-y divide-line">
            {coming.map((p) => {
              const rx = p.prescription;
              if (rx === null || rx.kind !== "working" || p.exerciseId === null) return null;
              const range = REP_RANGES[p.type];
              return (
                <li key={p.slotOrder} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-medium">{exerciseName(p.exerciseId)}</span>
                    <span className="shrink-0 text-base tabular-nums">
                      {formatKg(rx.weightG)} kg × {range.bottom}–{range.top}
                    </span>
                  </div>
                  {rx.reasonCode !== null && <p className="mt-0.5 text-sm text-muted">{REASON_LINES[rx.reasonCode]}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Screen>
  );
}

function Delta({ label, now, before }: { readonly label: string; readonly now: number; readonly before: number }) {
  const diff = now - before;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">
          <CountUp value={now} />
        </span>
        {before > 0 && diff !== 0 && <span className={`text-xs tabular-nums ${diff > 0 ? "text-accent" : "text-muted"}`}>{diff > 0 ? `+${diff}` : diff}</span>}
      </dd>
    </div>
  );
}

/** Counts up to a number once, softly. Shows the number straight away for people who ask for reduced motion. */
export function CountUp({ value, ms = 900 }: { readonly value: number; readonly ms?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{shown}</>;
}

/** Working weight per workout for one exercise: a soft line that draws itself in, best set marked, tap a point for its day. */
export function TrendChart({ name, points }: { readonly name: string; readonly points: readonly WeightPoint[] }) {
  const [sel, setSel] = useState<number | null>(null);
  if (points.length === 0) return null;
  if (points.length === 1) {
    const p = points[0];
    return (
      <div className="pressed mt-1 flex flex-col items-center gap-1 rounded-3xl p-5 text-center" data-chart>
        <p className="text-3xl font-semibold tabular-nums">{formatKg(p?.weightG ?? 0)} kg</p>
        <p className="text-sm text-muted">
          One workout so far ({shortDate(p?.date ?? "")}). Do {name} once more to see your trend.
        </p>
      </div>
    );
  }
  const W = 320;
  const H = 168;
  const pad = { l: 40, r: 14, t: 18, b: 26 };
  const ws = points.map((p) => p.weightG);
  let lo = Math.min(...ws);
  let hi = Math.max(...ws);
  if (lo === hi) {
    lo = Math.max(0, lo - 2000);
    hi = hi + 2000;
  }
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (g: number) => pad.t + (1 - (g - lo) / (hi - lo)) * (H - pad.t - pad.b);
  // A gentle curve through the points (Catmull-Rom as cubic Béziers), which never overshoots much between close weights.
  const pts = points.map((p, i) => [x(i), y(p.weightG)] as const);
  let d = `M${pts[0]?.[0].toFixed(1)},${pts[0]?.[1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]?.toFixed(1)},${c1[1]?.toFixed(1)} ${c2[0]?.toFixed(1)},${c2[1]?.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${d} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const bestI = points.reduce((b, p, i) => (p.weightG > (points[b]?.weightG ?? 0) || (p.weightG === points[b]?.weightG && p.totalReps > (points[b]?.totalReps ?? 0)) ? i : b), 0);
  const first = points[0]!;
  const last = points.at(-1)!;
  const shown = sel === null ? null : points[sel];
  const change = last.weightG - first.weightG;
  const summary = points.map((p) => `${shortDate(p.date)}: ${formatKg(p.weightG)} kg`).join(", ");
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3" aria-live="polite">
        <p className="text-2xl font-semibold tabular-nums">{formatKg((shown ?? last).weightG)} kg</p>
        <p className="text-sm text-muted">{shown !== null && shown !== undefined ? `${shortDate(shown.date)} · ${shown.sets} sets, ${shown.totalReps} reps` : change > 0 ? `+${formatKg(change)} kg since ${shortDate(first.date)}` : `Since ${shortDate(first.date)}`}</p>
      </div>
      <svg role="img" aria-label={`${name} working weight over time. ${summary}`} viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full overflow-visible" data-chart>
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[lo, (lo + hi) / 2, hi].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="var(--color-line)" strokeDasharray={g === lo ? undefined : "3 4"} />
            <text x={pad.l - 8} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill="var(--color-muted)">
              {formatKg(Math.round(g / 500) * 500)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#trend-fill)" className="fade-in" />
        <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="draw-line" />
        {points.map((p, i) => (
          <g key={p.date + i}>
            <circle cx={x(i)} cy={y(p.weightG)} r={i === sel ? 6 : i === bestI ? 5 : 3.5} fill={i === bestI || i === sel ? "var(--color-accent)" : "var(--color-bg)"} stroke="var(--color-accent)" strokeWidth="2" className="fade-in" />
            {/* A wide invisible target so a finger can pick a point. */}
            <rect x={x(i) - 14} y={pad.t - 10} width={28} height={H - pad.t - pad.b + 20} fill="transparent" onClick={() => setSel(sel === i ? null : i)} className="cursor-pointer" aria-hidden="true" />
          </g>
        ))}
        <text x={x(0)} y={H - 8} textAnchor="start" fontSize="10" fill="var(--color-muted)">
          {shortDate(first.date)}
        </text>
        <text x={x(points.length - 1)} y={H - 8} textAnchor="end" fontSize="10" fill="var(--color-muted)">
          {shortDate(last.date)}
        </text>
      </svg>
      <p className="mt-1 text-xs text-muted" data-chart-summary>
        Filled dot: your best workout. Tap any point to see that day.
      </p>
    </div>
  );
}
