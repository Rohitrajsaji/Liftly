// Logging one exercise (PRD F12): weight and target up front, reps prefilled, one tap on an effort button logs the set.

import { exercise } from "@liftly/catalog";
import type { Effort } from "@liftly/engine";
import { REP_RANGES } from "@liftly/engine";
import {
  calibrationLine,
  chooseWeight,
  currentStep,
  EFFORT_HELP,
  EFFORT_LABEL,
  endExercise,
  FIRST_EXPOSURE_LINE,
  formatClock,
  formatKg,
  logSet,
  REASON_LINES,
  restLabel,
  restRange,
  swapLine,
  undoLastSet,
  workingWeightLine,
  type ExerciseState,
  type SessionRecord,
} from "@liftly/workout";
import { useEffect, useState } from "react";
import { Bar } from "../dots";
import { exerciseName } from "../gym";
import { Button, Note, Screen } from "../ui";
import { previousText } from "./Home";

const EFFORTS: readonly Effort[] = ["easy", "good", "hard", "failed"];

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}

export function Exercise({
  session,
  index,
  previous,
  onUpdate,
  onList,
  onNext,
  onPain,
}: {
  readonly session: SessionRecord;
  readonly index: number;
  readonly previous: ExerciseState["lastPerformance"];
  readonly onUpdate: (fn: (s: SessionRecord) => SessionRecord) => void;
  readonly onList: () => void;
  /** Opens the next exercise that still has sets to do, or null when none is left. */
  readonly onNext: (() => void) | null;
  readonly onPain: () => void;
}) {
  const er = session.exercises[index];
  const ex = er === undefined ? null : exercise(er.exerciseId);
  const target = er === undefined ? 0 : currentStepTarget(er);
  const [reps, setReps] = useState(target);
  const [picking, setPicking] = useState(false);
  const setCount = er?.sets.length ?? 0;
  useEffect(() => {
    setReps(target);
  }, [target, setCount, index]);
  const now = useNow(1000);

  if (er === undefined || ex === null || ex.type === null) return null;
  const step = currentStep(er);
  const range = REP_RANGES[ex.type];
  const lastSession = session.exercises.flatMap((e) => e.sets).map((s) => Date.parse(s.loggedAt)).sort((a, b) => b - a)[0];
  const restOn = er.sets.length > 0 && (step.kind === "ramp" || step.kind === "working") && lastSession !== undefined;
  const rest = restRange(ex.type, step.kind === "ramp");
  const elapsed = lastSession === undefined ? 0 : Math.max(0, Math.round((now - lastSession) / 1000));

  const log = (effort: Effort) => onUpdate((s) => logSet(s, index, { reps, effort, now: new Date() }));
  const swapped = er.exerciseId !== er.slotExerciseId;
  const canChange = er.sets.length === 0 && (step.kind === "ramp" || step.kind === "working");
  const options = er.ladderG.filter((g) => er.prescription.decisionType !== "recalibration" || g <= er.prescription.weightG);

  const title = exerciseName(er.exerciseId);
  const heading = step.kind === "ramp" ? `Warm-up set ${step.rampNo}` : step.kind === "working" ? `Set ${step.setNo} of ${step.totalSets}` : step.kind === "stopped" ? "Stopped for today" : "All sets done";

  return (
    <Screen
      title={title}
      flow
      actions={
        <>
          {step.kind === "complete" && onNext !== null && (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={onNext}>Next exercise</Button>
              <Button variant="secondary" onClick={onList}>
                Workout list
              </Button>
            </div>
          )}
          {step.kind === "complete" && onNext === null && <Button onClick={onList}>Back to workout</Button>}
          {step.kind === "stopped" && <Button onClick={onList}>Back to workout</Button>}
          {(step.kind === "ramp" || step.kind === "working") && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onList}>
                Workout list
              </Button>
              <Button variant="secondary" onClick={() => onUpdate((s) => endExercise(s, index))}>
                End exercise
              </Button>
            </div>
          )}
          {step.kind !== "stopped" && (
            <button type="button" onClick={onPain} data-report-pain className="min-h-14 w-full rounded-xl border border-line bg-warn-soft px-5 text-base font-medium text-warn-ink">
              Report pain
            </button>
          )}
        </>
      }
    >
      <p className="-mt-3 text-base text-muted" data-set-heading>
        {heading}
      </p>
      {swapped && <Note>{swapLine(exerciseName(er.slotExerciseId), title)}</Note>}

      {(step.kind === "ramp" || step.kind === "working") && (
        <section className="card p-4" aria-label="Target">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Weight</p>
              <p className="flex items-baseline gap-1.5" data-weight>
                <span className="text-5xl font-semibold tabular-nums tracking-tight">{formatKg(step.weightG)}</span>
                <span className="text-lg text-muted">kg</span>
              </p>
            </div>
            <div className="text-right">
              <p className="eyebrow">Target</p>
              <p className="text-xl font-medium tabular-nums" data-target-reps>
                {range.bottom}–{range.top} reps
              </p>
            </div>
          </div>
          {step.kind === "ramp" && <p className="mt-2 text-sm text-muted">{calibrationLine(ex.type)}</p>}
          {step.kind === "working" && er.prescription.kind === "calibration" && er.workingWeightG !== null && <p className="mt-2 text-sm text-muted">{workingWeightLine(er.workingWeightG)}</p>}
          {step.kind === "working" && er.prescription.reasonCode !== null && er.prescription.kind === "working" && er.sets.length === 0 && <p className="mt-2 text-sm text-muted">{REASON_LINES[er.prescription.reasonCode]}</p>}
          {step.kind === "working" && step.firstExposure && er.prescription.kind === "working" && er.sets.length === 0 && <p className="mt-1 text-sm text-muted">{FIRST_EXPOSURE_LINE}</p>}
          {previous !== null && previous.sets.length > 0 && (
            <p className="mt-2 text-sm text-muted" data-previous>
              Last time: {previousText(previous)}
            </p>
          )}
          {canChange && (
            <button type="button" onClick={() => setPicking(!picking)} className="mt-2 min-h-12 rounded-xl text-base font-medium text-accent underline">
              {picking ? "Keep this weight" : "Use a different weight"}
            </button>
          )}
          {picking && canChange && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Weights">
              {options.map((g) => (
                <li key={g}>
                  <button
                    type="button"
                    aria-pressed={g === step.weightG}
                    onClick={() => {
                      onUpdate((s) => chooseWeight(s, index, g));
                      setPicking(false);
                    }}
                    className={`min-h-12 rounded-full border px-4 text-base tabular-nums ${g === step.weightG ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}
                  >
                    {formatKg(g)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {restOn && (
        <section role="timer" aria-label="Rest timer" data-rest className="card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">Rest</p>
            <p className="text-3xl font-semibold tabular-nums" data-rest-clock>
              {formatClock(elapsed)}
            </p>
          </div>
          <div className="mt-3">
            <Bar value={elapsed / rest.maxS} mark={rest.minS / rest.maxS} accent={elapsed >= rest.minS} />
          </div>
          <p className="mt-2 text-sm text-muted" data-rest-hint>
            {elapsed >= rest.minS ? "Ready when you are." : `Rest ${restLabel(rest)} before the next set.`}
          </p>
        </section>
      )}

      {(step.kind === "ramp" || step.kind === "working") && (
        <>
          <section aria-label="Reps">
            <p className="eyebrow mb-2">Reps</p>
            <div className="card flex items-center justify-between gap-4 p-3">
              <button type="button" aria-label="One rep less" disabled={reps <= 0} onClick={() => setReps(reps - 1)} className="size-16 rounded-xl bg-bg text-2xl font-medium disabled:opacity-40">
                −
              </button>
              <output aria-live="polite" className="text-5xl font-semibold tabular-nums" data-reps>
                {reps}
              </output>
              <button type="button" aria-label="One rep more" disabled={reps >= 100} onClick={() => setReps(reps + 1)} className="size-16 rounded-xl bg-bg text-2xl font-medium disabled:opacity-40">
                +
              </button>
            </div>
          </section>
          <section aria-label="How did it feel">
            <p className="eyebrow mb-2">How did it feel? Tap to log the set.</p>
            <div className="grid grid-cols-2 gap-2">
              {EFFORTS.map((e) => (
                <button key={e} type="button" data-effort={e} onClick={() => log(e)} className="card min-h-20 px-3 py-2 text-left active:bg-accent-soft">
                  <span className="block text-lg font-medium">{EFFORT_LABEL[e]}</span>
                  <span className="block text-sm text-muted">{EFFORT_HELP[e]}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {step.kind === "stopped" && er.pain !== null && <Note tone="warn">Pain reported. This exercise is stopped for today.</Note>}
      {step.kind === "complete" && er.sets.length > 0 && <Note>{er.prescription.kind === "calibration" && er.workingWeightG !== null ? workingWeightLine(er.workingWeightG) : "Nice work. This exercise is done."}</Note>}

      {er.sets.length > 0 && (
        <section aria-label="Logged sets">
          <ol className="card divide-y divide-line" data-logged>
            {er.sets.map((s, i) => (
              <li key={s.loggedAt + i} className="flex items-center justify-between px-4 py-3 text-base" data-logged-set>
                <span className="tabular-nums">
                  {s.kind === "ramp" ? "Warm-up" : `Set ${er.sets.slice(0, i + 1).filter((x) => x.kind === "working").length}`}: {formatKg(s.weightG)} kg × {s.reps}
                </span>
                <span className="text-muted">{EFFORT_LABEL[s.effort]}</span>
              </li>
            ))}
          </ol>
          {er.status !== "stopped_pain" && (
            <button type="button" onClick={() => onUpdate((s) => undoLastSet(s, index))} data-undo className="mt-1 min-h-12 rounded-xl px-2 text-base font-medium text-accent underline">
              Undo last set
            </button>
          )}
        </section>
      )}
    </Screen>
  );
}

/** The rep count to prefill: the engine's target for the next set. */
function currentStepTarget(er: SessionRecord["exercises"][number]): number {
  const s = currentStep(er);
  return s.kind === "ramp" || s.kind === "working" ? s.targetReps : 0;
}
