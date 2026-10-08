// Progress (PRD F14): weight over time per exercise, personal records, sessions per week. All of it is read from the
// finished workouts on the device, so it works offline.

import { formatKg, personalRecords, sessionsPerWeek, weightHistory, type SessionRecord, type WeightPoint } from "@liftly/workout";
import { useState } from "react";
import { exerciseName } from "../gym";
import { localDate } from "../onboarding";
import { Screen } from "../ui";

const shortDate = (d: string): string => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
};

export function Progress({ sessions }: { readonly sessions: readonly SessionRecord[] }) {
  const history = weightHistory(sessions);
  const ids = Object.keys(history);
  const [picked, setPicked] = useState<string | null>(null);
  const current = picked !== null && ids.includes(picked) ? picked : (ids[0] ?? null);
  const records = personalRecords(sessions);
  const weeks = sessionsPerWeek(sessions, localDate(new Date()), 8);
  const maxWeek = Math.max(1, ...weeks.map((w) => w.sessions));

  if (sessions.length === 0) {
    return (
      <Screen title="Progress">
        <p className="text-base text-muted" data-empty>
          Nothing to show yet. Finish your first workout and your weights, records and weekly count will appear here.
        </p>
      </Screen>
    );
  }
  return (
    <Screen title="Progress">
      <section className="card p-4" aria-label="Weight over time" data-weight-chart>
        <p className="eyebrow">Weight over time</p>
        <ul className="my-3 flex flex-wrap gap-2" aria-label="Exercise">
          {ids.map((id) => (
            <li key={id}>
              <button type="button" aria-pressed={id === current} onClick={() => setPicked(id)} className={`min-h-12 rounded-full px-4 text-sm ${id === current ? "pressed font-medium text-accent" : "raised"}`}>
                {exerciseName(id)}
              </button>
            </li>
          ))}
        </ul>
        {current !== null && <WeightChart points={history[current] ?? []} />}
      </section>

      <section className="card p-4" aria-label="Personal records" data-records>
        <p className="eyebrow">Personal records</p>
        <ul className="mt-2 divide-y divide-line">
          {records.map((r) => (
            <li key={r.exerciseId} className="flex items-baseline justify-between gap-3 py-3" data-record>
              <span>
                <span className="block text-base font-medium">{exerciseName(r.exerciseId)}</span>
                <span className="text-sm text-muted">{shortDate(r.date)}</span>
              </span>
              <span className="text-base tabular-nums">
                {formatKg(r.weightG)} kg × {r.reps}
              </span>
            </li>
          ))}
          {records.length === 0 && <li className="py-3 text-sm text-muted">A record needs a set at your target reps or more.</li>}
        </ul>
      </section>

      <section className="card p-4" aria-label="Sessions per week" data-weeks>
        <p className="eyebrow">Workouts per week</p>
        <ol className="mt-3 flex items-end justify-between gap-2" style={{ height: 120 }}>
          {weeks.map((w) => (
            <li key={w.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs tabular-nums text-muted">{w.sessions}</span>
              <span className={`w-full rounded-full ${w.sessions > 0 ? "bg-accent" : "pressed"}`} style={{ height: `${Math.max(8, (w.sessions / maxWeek) * 70)}px` }} />
              <span className="text-[10px] text-muted">{shortDate(w.weekStart)}</span>
            </li>
          ))}
        </ol>
      </section>
    </Screen>
  );
}

function WeightChart({ points }: { readonly points: readonly WeightPoint[] }) {
  if (points.length === 0) return null;
  const W = 320;
  const H = 150;
  const pad = { l: 52, r: 12, t: 12, b: 24 };
  const ws = points.map((p) => p.weightG);
  let lo = Math.min(...ws);
  let hi = Math.max(...ws);
  if (lo === hi) {
    lo = Math.max(0, lo - 1000);
    hi = hi + 1000;
  }
  const x = (i: number) => (points.length === 1 ? W / 2 : pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (g: number) => pad.t + (1 - (g - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.weightG).toFixed(1)}`).join(" ");
  const last = points.at(-1);
  const summary = points.map((p) => `${shortDate(p.date)}: ${formatKg(p.weightG)} kg`).join(", ");
  return (
    <div>
      <svg role="img" aria-label={`Weight over time. ${summary}`} viewBox={`0 0 ${W} ${H}`} className="w-full" data-chart>
        <text x={pad.l - 6} y={y(hi) + 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">
          {formatKg(hi)} kg
        </text>
        <text x={pad.l - 6} y={y(lo) + 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">
          {formatKg(lo)} kg
        </text>
        <line x1={pad.l} x2={W - pad.r} y1={y(lo)} y2={y(lo)} stroke="var(--color-line)" />
        {points.length > 1 && <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          <circle key={p.date + i} cx={x(i)} cy={y(p.weightG)} r={i === points.length - 1 ? 5 : 3.5} fill={i === points.length - 1 ? "var(--color-accent)" : "var(--color-ink)"} />
        ))}
        <text x={x(0)} y={H - 6} textAnchor={points.length === 1 ? "middle" : "start"} fontSize="10" fill="var(--color-muted)">
          {shortDate(points[0]?.date ?? "")}
        </text>
        {points.length > 1 && (
          <text x={x(points.length - 1)} y={H - 6} textAnchor="end" fontSize="10" fill="var(--color-muted)">
            {shortDate(last?.date ?? "")}
          </text>
        )}
      </svg>
      {points.length === 1 ? <p className="text-sm text-muted">One workout so far. Finish another to see a line.</p> : last !== undefined && <p className="text-sm text-muted" data-chart-summary>Now {formatKg(last.weightG)} kg, started at {formatKg(points[0]?.weightG ?? 0)} kg.</p>}
    </div>
  );
}
