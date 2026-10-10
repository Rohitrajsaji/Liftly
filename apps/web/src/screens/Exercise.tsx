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
  updateWorkingSet,
  workingWeightLine,
  type ExerciseState,
  type SessionRecord,
} from "@liftly/workout";
import { useEffect, useRef, useState } from "react";
import { chime, unlockChime } from "../chime";
import { Ring, WorkoutProgress } from "../dots";
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
  upNext,
  onPain,
}: {
  readonly session: SessionRecord;
  readonly index: number;
  readonly previous: ExerciseState["lastPerformance"];
  readonly onUpdate: (fn: (s: SessionRecord) => SessionRecord) => void;
  readonly onList: () => void;
  /** Opens the next exercise that still has sets to do, or null when none is left. */
  readonly onNext: (() => void) | null;
  /** The exercise onNext opens, shown on an "Up next" card once this one is done. */
  readonly upNext: { readonly name: string; readonly target: string } | null;
  readonly onPain: () => void;
}) {
  const er = session.exercises[index];
  const ex = er === undefined ? null : exercise(er.exerciseId);
  const target = er === undefined ? 0 : currentStepTarget(er);
  const [reps, setReps] = useState(target);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [skippedRestFor, setSkippedRestFor] = useState<number | null>(null);
  const setCount = er?.sets.length ?? 0;
  useEffect(() => {
    setReps(target);
  }, [target, setCount, index]);
  const now = useNow(1000);

  if (er === undefined || ex === null || ex.type === null) return null;
  const step = currentStep(er);
  const range = REP_RANGES[ex.type];
  const lastSession = session.exercises.flatMap((e) => e.sets).map((s) => Date.parse(s.loggedAt)).sort((a, b) => b - a)[0];
  const restOn = er.sets.length > 0 && (step.kind === "ramp" || step.kind === "working") && lastSession !== undefined && skippedRestFor !== lastSession;
  const rest = restRange(ex.type, step.kind === "ramp");
  const elapsed = lastSession === undefined ? 0 : Math.max(0, Math.round((now - lastSession) / 1000));
  const ready = elapsed >= rest.minS;

  const log = (effort: Effort) => {
    unlockChime();
    setEditing(null);
    onUpdate((s) => logSet(s, index, { reps, effort, now: new Date() }));
  };
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
          {step.kind === "complete" && onNext !== null && <Button onClick={onNext}>Next exercise</Button>}
          {step.kind === "complete" && onNext === null && <Button onClick={onList}>Back to workout</Button>}
          {step.kind === "stopped" && <Button onClick={onList}>Back to workout</Button>}
          <div className="grid grid-cols-2 gap-2">
            {(step.kind !== "stopped" && !(step.kind === "complete" && onNext === null)) && (
              <Button variant="secondary" onClick={onList}>
                Workout list
              </Button>
            )}
            {(step.kind === "ramp" || step.kind === "working") && (
              <Button variant="secondary" onClick={() => onUpdate((s) => endExercise(s, index))}>
                End exercise
              </Button>
            )}
            {step.kind !== "stopped" && (
              <button type="button" onClick={onPain} data-report-pain className={`raised min-h-14 w-full rounded-full px-5 text-base font-medium text-warn-ink ${step.kind === "ramp" || step.kind === "working" ? "col-span-2" : ""}`}>
                Report pain
              </button>
            )}
          </div>
        </>
      }
    >
      <WorkoutProgress session={session} now={now} />
      <p className="-mt-1 text-base text-muted" data-set-heading>
        {heading}
      </p>
      {swapped && <Note>{swapLine(exerciseName(er.slotExerciseId), title)}</Note>}

      {restOn ? (
        <RestTimer elapsed={elapsed} minS={rest.minS} hint={ready ? "Ready when you are." : `Rest ${restLabel(rest)} before the next set.`} onSkip={() => setSkippedRestFor(lastSession ?? null)} />
      ) : null}

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
            <button type="button" onClick={() => setPicking(!picking)} className="mt-2 min-h-12 text-base font-medium text-accent underline underline-offset-4">
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
                    className={`min-h-12 rounded-full px-4 text-base tabular-nums ${g === step.weightG ? "pressed font-medium text-accent" : "raised"}`}
                  >
                    {formatKg(g)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(step.kind === "ramp" || step.kind === "working") && (
        <>
          <section aria-label="Reps">
            <p className="eyebrow mb-2">Reps</p>
            <div className="pressed flex items-center justify-between gap-4 rounded-3xl p-3">
              <button type="button" aria-label="One rep less" disabled={reps <= 0} onClick={() => setReps(reps - 1)} className="raised size-16 rounded-full text-2xl font-medium disabled:opacity-40">
                −
              </button>
              <output aria-live="polite" className="text-5xl font-semibold tabular-nums" data-reps>
                {reps}
              </output>
              <button type="button" aria-label="One rep more" disabled={reps >= 100} onClick={() => setReps(reps + 1)} className="raised size-16 rounded-full text-2xl font-medium disabled:opacity-40">
                +
              </button>
            </div>
          </section>
          <section aria-label="How did it feel">
            <p className="eyebrow mb-2">How did it feel? Tap to log the set.</p>
            <div className="grid grid-cols-2 gap-2">
              {EFFORTS.map((e) => (
                <button key={e} type="button" data-effort={e} onClick={() => log(e)} className="raised min-h-20 rounded-3xl px-4 py-2 text-left">
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

      {step.kind === "complete" && upNext !== null && (
        <section className="card-accent rise flex items-center justify-between gap-3 p-4" aria-label="Up next" data-up-next>
          <span>
            <span className="block text-sm text-muted">Up next</span>
            <span className="block text-base font-medium">{upNext.name}</span>
          </span>
          <span className="shrink-0 text-right text-base tabular-nums">{upNext.target}</span>
        </section>
      )}

      {er.sets.length > 0 && (
        <section aria-label="Logged sets">
          <ol className="pressed divide-y divide-line rounded-3xl px-1" data-logged>
            {er.sets.map((s, i) => {
              const editable = !s.partOfRamp && er.status !== "stopped_pain";
              const label = `${s.kind === "ramp" ? "Warm-up" : `Set ${er.sets.slice(0, i + 1).filter((x) => x.kind === "working").length}`}: ${formatKg(s.weightG)} kg × ${s.reps}`;
              return (
                <li key={s.loggedAt + i} className="pop" data-logged-set>
                  {editing === i ? (
                    <SetEditor
                      label={label}
                      reps={s.reps}
                      effort={s.effort}
                      onSave={(r, e) => {
                        onUpdate((x) => updateWorkingSet(x, index, i, { reps: r, effort: e }));
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => setEditing(i)}
                      aria-label={editable ? `${label}, ${EFFORT_LABEL[s.effort]}. Change this set` : undefined}
                      className="flex min-h-[3.25rem] w-full items-center justify-between px-4 py-3 text-left text-base"
                    >
                      <span className="tabular-nums">{label}</span>
                      <span className="flex items-center gap-2 text-muted">
                        {EFFORT_LABEL[s.effort]}
                        {editable && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                          </svg>
                        )}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {er.status !== "stopped_pain" && (
            <div className="mt-1 flex items-center justify-between">
              <button type="button" onClick={() => onUpdate((s) => undoLastSet(s, index))} data-undo className="min-h-12 text-base font-medium text-accent underline underline-offset-4">
                Undo last set
              </button>
              <span className="text-sm text-muted">Tap a set to change it</span>
            </div>
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

/** Counts down the suggested rest on a ring, chimes once when it is over, then shows how long you have rested. */
function RestTimer({ elapsed, minS, hint, onSkip }: { readonly elapsed: number; readonly minS: number; readonly hint: string; readonly onSkip: () => void }) {
  const ready = elapsed >= minS;
  const chimed = useRef(ready);
  useEffect(() => {
    if (ready && !chimed.current) chime();
    chimed.current = ready;
  }, [ready]);
  return (
    <section role="timer" aria-label="Rest timer" data-rest className="card rise flex items-center gap-5 p-4">
      <Ring value={elapsed / minS} accent={ready} size={112} stroke={9}>
        <p className="text-2xl font-semibold tabular-nums" data-rest-clock>
          {ready ? formatClock(elapsed) : formatClock(minS - elapsed)}
        </p>
        <p className="text-xs text-muted">{ready ? "rested" : "left"}</p>
      </Ring>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={`text-base font-medium ${ready ? "text-accent" : ""}`}>{ready ? "Ready for the next set" : "Resting"}</p>
        <p className="text-sm text-muted" data-rest-hint>
          {hint}
        </p>
        {!ready && (
          <button type="button" onClick={onSkip} className="min-h-12 self-start text-sm font-medium text-accent underline underline-offset-4" data-skip-rest>
            Skip rest
          </button>
        )}
      </div>
    </section>
  );
}

/** Changes the reps or effort of a set already logged (working sets only; a warm-up set is taken back with Undo). */
function SetEditor({ label, reps, effort, onSave, onCancel }: { readonly label: string; readonly reps: number; readonly effort: Effort; readonly onSave: (reps: number, effort: Effort) => void; readonly onCancel: () => void }) {
  const [r, setR] = useState(reps);
  const [e, setE] = useState(effort);
  return (
    <div className="fade-in flex flex-col gap-3 p-3" data-set-editor>
      <p className="px-1 text-sm text-muted">Change {label.split(":")[0]}</p>
      <div className="flex items-center justify-between gap-3">
        <button type="button" aria-label="One rep less" disabled={r <= 0} onClick={() => setR(r - 1)} className="raised size-12 rounded-full text-xl disabled:opacity-40">
          −
        </button>
        <output className="text-3xl font-semibold tabular-nums">{r}</output>
        <button type="button" aria-label="One rep more" disabled={r >= 100} onClick={() => setR(r + 1)} className="raised size-12 rounded-full text-xl disabled:opacity-40">
          +
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {EFFORTS.map((x) => (
          <button key={x} type="button" aria-pressed={e === x} onClick={() => setE(x)} className={`min-h-12 rounded-full text-sm ${e === x ? "pressed font-medium text-accent" : "raised"}`}>
            {EFFORT_LABEL[x]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(r, e)}>Save set</Button>
      </div>
    </div>
  );
}
