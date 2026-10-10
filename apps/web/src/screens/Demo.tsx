// "See it in action" on the website: the app's own pieces running on sample data, so a visitor can try logging a set,
// see a progress chart and read an example summary without installing anything. Clearly marked as sample data.
// The installed app never shows this; it only ever shows the person's own workouts.

import { EFFORT_HELP, EFFORT_LABEL, formatClock, rulesPicks, tailoredProgram, type TailorAnswers, type WeightPoint } from "@liftly/workout";
import type { Effort } from "@liftly/engine";
import { useEffect, useState } from "react";
import { Ring } from "../dots";
import { EQUIPMENT_LABEL, planPreview } from "../plan";
import { TrendChart } from "./Progress";

type Tab = "log" | "progress" | "plan" | "summary";
const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: "log", label: "Log a set" },
  { id: "progress", label: "Progress" },
  { id: "plan", label: "Your plan" },
  { id: "summary", label: "Summary" },
];

const EFFORTS: readonly Effort[] = ["easy", "good", "hard", "failed"];
const DEMO_REST_S = 12; // shortened for the demo; the app uses 1 to 3 minutes

// Six weeks of a beginner's Leg Press: the weight climbs one ladder step at a time.
const SAMPLE_TREND: readonly WeightPoint[] = [
  ["2026-08-31", 30000, 27],
  ["2026-09-03", 30000, 30],
  ["2026-09-07", 32500, 26],
  ["2026-09-10", 32500, 31],
  ["2026-09-14", 35000, 27],
  ["2026-09-17", 35000, 33],
  ["2026-09-21", 37500, 28],
  ["2026-09-24", 37500, 32],
  ["2026-09-28", 40000, 29],
  ["2026-10-01", 40000, 34],
].map(([date, weightG, totalReps]) => ({ date: date as string, weightG: weightG as number, totalReps: totalReps as number, sets: 3 }));

export function Demo() {
  const [tab, setTab] = useState<Tab>("log");
  return (
    <div className="flex flex-col items-center gap-5" data-demo>
      <div className="pressed grid w-full max-w-sm grid-cols-4 gap-1 rounded-full p-1" role="tablist" aria-label="Demo">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`min-h-12 rounded-full text-sm ${tab === t.id ? "raised font-medium text-accent" : "text-muted"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {/* A phone-sized frame, so the demo reads as the app it is. */}
      <div className="card w-full max-w-sm overflow-hidden p-2">
        <div className="rounded-[1.4rem] p-4" style={{ minHeight: 520 }}>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-base font-semibold">Liftly</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">Sample data</span>
          </div>
          <div key={tab} className="screen-fade">
            {tab === "log" && <LogDemo />}
            {tab === "progress" && <ProgressDemo />}
            {tab === "plan" && <PlanDemo />}
            {tab === "summary" && <SummaryDemo />}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogDemo() {
  const [reps, setReps] = useState(10);
  const [sets, setSets] = useState<{ reps: number; effort: Effort }[]>([]);
  const [restStart, setRestStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (restStart === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [restStart]);
  const elapsed = restStart === null ? 0 : Math.floor((now - restStart) / 1000);
  const done = sets.length >= 3;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xl font-semibold">Leg Press</p>
        <p className="text-sm text-muted">{done ? "All sets done" : `Set ${sets.length + 1} of 3`}</p>
      </div>
      <div className="card flex items-end justify-between p-4">
        <div>
          <p className="eyebrow">Weight</p>
          <p className="text-4xl font-semibold tabular-nums">
            40 <span className="text-base font-normal text-muted">kg</span>
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Target</p>
          <p className="text-lg font-medium">8–12 reps</p>
        </div>
      </div>
      {restStart !== null && !done && (
        <div className="card rise flex items-center gap-4 p-3">
          <Ring value={elapsed / DEMO_REST_S} accent={elapsed >= DEMO_REST_S} size={72} stroke={7}>
            <span className="text-sm font-semibold tabular-nums">{elapsed >= DEMO_REST_S ? "Go" : formatClock(DEMO_REST_S - elapsed)}</span>
          </Ring>
          <p className="text-sm text-muted">{elapsed >= DEMO_REST_S ? "Ready for the next set." : "Resting. The timer starts by itself after every set."}</p>
        </div>
      )}
      {!done ? (
        <>
          <div className="pressed flex items-center justify-between rounded-3xl p-2">
            <button type="button" aria-label="One rep less" onClick={() => setReps(Math.max(0, reps - 1))} className="raised size-12 rounded-full text-xl">
              −
            </button>
            <span className="text-3xl font-semibold tabular-nums">{reps}</span>
            <button type="button" aria-label="One rep more" onClick={() => setReps(reps + 1)} className="raised size-12 rounded-full text-xl">
              +
            </button>
          </div>
          <p className="eyebrow -mb-2">How did it feel? Tap to log the set.</p>
          <div className="grid grid-cols-2 gap-2">
            {EFFORTS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setSets([...sets, { reps, effort: e }]);
                  setRestStart(Date.now());
                  setNow(Date.now());
                }}
                className="raised min-h-14 rounded-2xl px-3 py-2 text-left"
              >
                <span className="block text-base font-medium">{EFFORT_LABEL[e]}</span>
                <span className="block text-xs text-muted">{EFFORT_HELP[e]}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="card-accent rise p-4">
          <p className="text-sm text-muted">Next time</p>
          <p className="text-lg font-medium tabular-nums">{sets.every((s) => s.reps >= 12 && s.effort !== "failed") ? "42.5 kg × 8–12" : "40 kg × 8–12"}</p>
          <p className="text-sm text-muted">{sets.every((s) => s.reps >= 12 && s.effort !== "failed") ? "You reached the top of the range, so the weight goes up one step." : "Same weight. Try for one more rep than your lowest set."}</p>
          <button type="button" onClick={() => { setSets([]); setRestStart(null); }} className="mt-2 min-h-12 text-sm font-medium text-accent underline underline-offset-4">
            Try again
          </button>
        </div>
      )}
      {sets.length > 0 && (
        <ol className="pressed divide-y divide-line rounded-3xl px-1">
          {sets.map((s, i) => (
            <li key={i} className="pop flex justify-between px-4 py-2.5 text-sm">
              <span className="tabular-nums">
                Set {i + 1}: 40 kg × {s.reps}
              </span>
              <span className="text-muted">{EFFORT_LABEL[s.effort]}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ProgressDemo() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xl font-semibold">Progress</p>
      <div className="card flex items-center gap-4 p-4">
        <Ring value={2 / 3} accent size={88} stroke={8}>
          <span className="text-lg font-semibold">2/3</span>
        </Ring>
        <dl className="grid flex-1 gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Sets</dt>
            <dd className="font-semibold tabular-nums">
              28 <span className="text-xs text-accent">+6</span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Reps</dt>
            <dd className="font-semibold tabular-nums">286</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Weeks on plan</dt>
            <dd className="font-semibold tabular-nums">5</dd>
          </div>
        </dl>
      </div>
      <div className="card p-4">
        <p className="eyebrow mb-2">Leg Press</p>
        <TrendChart name="Leg Press" points={SAMPLE_TREND} />
      </div>
    </div>
  );
}

function SummaryDemo() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xl font-semibold">Workout complete</p>
      <div className="card flex items-center gap-4 p-4">
        <Ring value={1} accent size={80} stroke={7}>
          <span className="text-base font-semibold">5/5</span>
        </Ring>
        <dl className="grid flex-1 grid-cols-2 gap-2 text-sm">
          {[
            ["Time", "52 min"],
            ["Sets", "14"],
            ["Reps", "142"],
            ["Lifted", "4,310 kg"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="card-accent p-4">
        <p className="eyebrow">Example summary by AI</p>
        <p className="mt-1 text-sm leading-relaxed">
          You hit 12 reps on all 3 sets of Leg Press at 40 kg, your best yet. Because you reached the top of the range, it moves up to 42.5 kg next time. Your Lat Pulldown reps dropped on the last set, so keep the same weight and aim for one more rep.
        </p>
      </div>
      <p className="text-xs text-muted">The AI only explains. Liftly's own rules decide every weight and rep, and the AI summary is optional.</p>
    </div>
  );
}

// A sample set of answers, run through the app's own rules on the real 3-day catalog: nothing here is made up.
const SAMPLE_ANSWERS: TailorAnswers = { unavailable: ["cable"], preference: "free_weights", avoid: [] };

function PlanDemo() {
  const picks = rulesPicks("3-day", SAMPLE_ANSWERS).picks;
  const fixed = planPreview("3-day").workouts[0];
  const tailored = planPreview("3-day", tailoredProgram("3-day", picks)).workouts[0];
  return (
    <div className="flex flex-col gap-4" data-demo-plan>
      <div>
        <p className="eyebrow">Tailored for you</p>
        <p className="mt-1 text-sm text-muted">Sample answers: no cable machines, prefers dumbbells and bodyweight.</p>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {tailored?.exercises.map((e) => (
          <li key={e.order} className="flex items-center justify-between gap-3 py-3">
            <span>
              <span className="block text-sm font-medium">{e.name}</span>
              <span className="text-xs text-muted">
                {EQUIPMENT_LABEL[e.equipment]}
                {fixed?.exercises.find((f) => f.order === e.order)?.name !== e.name && " · Changed for you"}
              </span>
            </span>
            <span className="shrink-0 text-sm tabular-nums">
              {e.sets} × {e.reps}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">With an account and your OK, an AI can pick between the approved options. Liftly checks its choice and sets every weight and rep.</p>
    </div>
  );
}
