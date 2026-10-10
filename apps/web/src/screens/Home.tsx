// Today (PRD F11): the next workout in the sequence with each exercise's weight, sets and reps, and why.

import { exercise } from "@liftly/catalog";
import { REP_RANGES } from "@liftly/engine";
import { FIRST_EXPOSURE_LINE, FOLLOW_UP_QUESTION, formatKg, REASON_LINES, swapLine, PAUSED_SLOT_TEXT, type FollowUp, type PlannedExercise, type SessionRecord } from "@liftly/workout";
import { exerciseName } from "../gym";
import { Button, Note, Screen } from "../ui";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A pain report is asked about once it is a day old (SAFETY: 24-hour follow-up). */
export function dueFollowUps(open: readonly FollowUp[], now: Date): FollowUp[] {
  return open.filter((f) => now.getTime() - Date.parse(f.reportedAt) >= DAY_MS);
}

export function Home({
  plan,
  planError,
  missingGym,
  active,
  followUps,
  lastDone,
  onStart,
  onContinue,
  onGym,
  onPlan,
  onAnswer,
  workoutName,
  start,
}: {
  readonly plan: readonly PlannedExercise[] | null;
  readonly planError: string | null;
  readonly missingGym: boolean;
  readonly active: SessionRecord | null;
  readonly followUps: readonly FollowUp[];
  readonly lastDone: string | null;
  readonly onStart: () => void;
  readonly onContinue: () => void;
  readonly onGym: () => void;
  readonly onPlan: () => void;
  readonly onAnswer: (painId: string, stillPresent: boolean) => void;
  readonly workoutName: string;
  /** First-run guide: shown until the first workout is done. */
  readonly start: { readonly gymDone: boolean; readonly accountDone: boolean; readonly accountAvailable: boolean; readonly onAccount: () => void } | null;
}) {
  const follow = followUps[0];
  return (
    <Screen
      title="Today"
      actions={
        missingGym ? (
          <Button onClick={onGym}>Set your gym's weights</Button>
        ) : active !== null ? (
          <Button onClick={onContinue}>Continue workout</Button>
        ) : (
          <Button onClick={onStart} disabled={plan === null}>
            Start workout
          </Button>
        )
      }
    >
      {follow !== undefined && (
        <section className="rounded-3xl bg-warn-soft p-4 text-warn-ink shadow-[inset_3px_3px_6px_#d6c595,inset_-3px_-3px_6px_#fff6d6]" data-follow-up aria-label="Pain check-in">
          <p className="text-base font-medium">{FOLLOW_UP_QUESTION}</p>
          <p className="mt-1 text-sm">{exerciseName(follow.exerciseId)}. It's a quick check so Liftly knows when it is safe to progress again.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => onAnswer(follow.painId, true)}>
              Still there
            </Button>
            <Button variant="secondary" onClick={() => onAnswer(follow.painId, false)}>
              Gone
            </Button>
          </div>
        </section>
      )}
      <div>
        <p className="text-2xl font-semibold" data-workout-name>
          {workoutName}
        </p>
        <p className="text-base text-muted">{lastDone === null ? "Your first workout. Take it easy and find your starting weights." : `Last workout: ${lastDone}`}</p>
      </div>
      {start !== null && active === null && (
        <section className="card p-5" aria-label="Getting started" data-getting-started>
          <p className="text-base font-medium">Getting started</p>
          <ol className="mt-3 flex flex-col gap-3 text-base">
            <Step done label="Your plan is ready" />
            <Step done={start.gymDone} label="Set your gym's weights" hint={start.gymDone ? undefined : "One minute, once. Liftly only suggests weights your gym really has."} />
            <Step done={false} label="Do your first workout" hint="Start light. Liftly finds your starting weights as you go." />
            {start.accountAvailable && (
              <Step done={start.accountDone} label="Save your progress with an account" hint="Optional. Keeps your workouts safe if you change phone." action={start.accountDone ? undefined : { label: "Create account", onClick: start.onAccount }} />
            )}
          </ol>
        </section>
      )}
      {missingGym && <Note>Liftly needs the weights your gym has before it can suggest anything. It takes about a minute, and you only do it once.</Note>}
      {plan !== null && plan.length > 0 && plan.every((p) => p.prescription?.kind === "calibration" && p.prescription.reasonCode === null) && (
        <Note>
          <span data-calibration-note>Finding your starting weights today. Start light and go up one step at a time until the first reps feel Good.</span>
        </Note>
      )}
      {planError !== null && !missingGym && <Note tone="warn">{planError}</Note>}
      {plan !== null && (
        <ol className="stagger flex flex-col gap-4" aria-label="Today's exercises" data-plan>
          {plan.map((p) => (
            <li key={p.slotOrder} className="card p-5" data-exercise-row>
              <PlannedRow p={p} />
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onPlan} className="min-h-12 rounded-xl px-3 text-base font-medium text-accent underline">
          See full plan
        </button>
        <button type="button" onClick={onGym} className="min-h-12 rounded-xl px-3 text-base font-medium text-accent underline">
          Gym weights
        </button>
      </div>
    </Screen>
  );
}

function Step({ done, label, hint, action }: { readonly done: boolean; readonly label: string; readonly hint?: string | undefined; readonly action?: { readonly label: string; readonly onClick: () => void } | undefined }) {
  return (
    <li className="flex items-start gap-3" data-step={done ? "done" : "todo"}>
      <span aria-hidden="true" className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-sm ${done ? "bg-accent text-accent-ink" : "pressed"}`}>
        {done ? "✓" : ""}
      </span>
      <span>
        <span className={done ? "text-muted" : "font-medium"}>{label}</span>
        <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
        {hint !== undefined && <span className="block text-sm text-muted">{hint}</span>}
        {action !== undefined && (
          <button type="button" onClick={action.onClick} className="min-h-12 rounded-xl text-sm font-medium text-accent underline">
            {action.label}
          </button>
        )}
      </span>
    </li>
  );
}

export function targetText(p: PlannedExercise): string {
  const range = REP_RANGES[p.type];
  if (p.paused || p.prescription === null) return "Left out";
  if (p.prescription.kind === "calibration") return `${p.sets} × ${range.bottom}–${range.top}`;
  return `${formatKg(p.prescription.weightG)} kg × ${p.sets} × ${range.bottom}–${range.top}`;
}

function PlannedRow({ p }: { readonly p: PlannedExercise }) {
  const name = p.exerciseId === null ? exerciseName(p.slotExerciseId) : exerciseName(p.exerciseId);
  const rx = p.prescription;
  const lines: string[] = [];
  if (p.paused) lines.push(PAUSED_SLOT_TEXT);
  if (p.isSwap && p.exerciseId !== null) lines.push(swapLine(exercise(p.slotExerciseId).name, exercise(p.exerciseId).name));
  if (rx !== null) {
    if (rx.kind === "calibration") if (rx.reasonCode === "RECAL") lines.push(REASON_LINES.RECAL);
    else {
      if (rx.reasonCode !== null) lines.push(REASON_LINES[rx.reasonCode]);
      if (rx.firstExposure) lines.push(FIRST_EXPOSURE_LINE);
    }
  }
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-medium" data-name>
          {name}
        </span>
        <span className="shrink-0 text-right text-base tabular-nums" data-target>
          {targetText(p)}
        </span>
      </div>
      {lines.map((l) => (
        <p key={l} className="mt-1 text-sm text-muted">
          {l}
        </p>
      ))}
      {p.previous !== null && p.previous.sets.length > 0 && <p className="mt-1 text-sm text-muted">Last time: {previousText(p.previous)}</p>}
    </>
  );
}

export function previousText(prev: NonNullable<PlannedExercise["previous"]>): string {
  const work = prev.sets.filter((s) => s.kind === "working");
  const sets = work.length > 0 ? work : prev.sets;
  const weight = sets[0]?.weightG;
  const sameWeight = weight !== undefined && sets.every((s) => s.weightG === weight);
  const reps = sets.map((s) => s.reps).join(", ");
  return sameWeight ? `${formatKg(weight)} kg × ${reps}` : sets.map((s) => `${formatKg(s.weightG)} kg × ${s.reps}`).join(", ");
}
