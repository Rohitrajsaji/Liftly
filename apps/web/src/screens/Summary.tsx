// After the workout: what was done and what comes next, straight from the engine's decision (PRD F13).

import { REP_RANGES } from "@liftly/engine";
import { exercise } from "@liftly/catalog";
import { calibrationLine, FIRST_EXPOSURE_LINE, formatKg, PAIN_ON_SWAP_TEXT, PAIN_STOP_TEXT, REASON_LINES, workingSets, workingWeightLine, type ExerciseRecord, type SessionRecord } from "@liftly/workout";
import { DotFace, ProgressDots } from "../dots";
import { exerciseName } from "../gym";
import { Button, Note, Screen } from "../ui";

export function Summary({ session, onHome, accountPrompt }: { readonly session: SessionRecord; readonly onHome: () => void; readonly accountPrompt: { readonly onCreate: () => void } | null }) {
  const done = session.exercises.filter((e) => e.status === "done").length;
  return (
    <Screen title={session.completion === "full" ? "Workout complete" : "Workout saved"} actions={<Button onClick={onHome}>Done</Button>}>
      <div className="card flex items-center gap-4 p-4">
        <DotFace mood="happy" className="shrink-0 text-ink" />
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Summary</p>
          <p className="text-base" data-summary-count>
            {done} of {session.exercises.length} exercises done.
          </p>
          <ProgressDots done={done} total={session.exercises.length} />
        </div>
      </div>
      <ol className="flex flex-col gap-3" aria-label="Results">
        {session.exercises.map((er) => (
          <li key={er.slotOrder} className="card p-4" data-result={er.exerciseId}>
            <p className="text-base font-medium">{exerciseName(er.exerciseId)}</p>
            <Result er={er} />
          </li>
        ))}
      </ol>
      {accountPrompt !== null && (
        <Note>
          This workout is saved on your phone only.{" "}
          <button type="button" onClick={accountPrompt.onCreate} className="min-h-12 font-medium text-accent underline">
            Create an account to back it up
          </button>
        </Note>
      )}
    </Screen>
  );
}

function Result({ er }: { readonly er: ExerciseRecord }) {
  const type = exercise(er.exerciseId).type ?? "compound";
  const range = REP_RANGES[type];
  if (er.status === "skipped") return <p className="text-sm text-muted">Skipped. Nothing changes for this exercise.</p>;
  if (er.status === "stopped_pain") return <p className="text-sm text-muted">{er.slotPausedAfter ? PAIN_ON_SWAP_TEXT : PAIN_STOP_TEXT}</p>;
  const sets = workingSets(er);
  const d = er.outcome?.decision ?? null;
  return (
    <>
      <p className="text-sm text-muted tabular-nums">{sets.map((s) => `${formatKg(s.weightG)} kg × ${s.reps}`).join(" · ")}</p>
      {er.outcome?.calibratedWeightG != null && <p className="mt-1 text-sm text-muted">{workingWeightLine(er.outcome.calibratedWeightG)}</p>}
      {er.prescription.kind === "calibration" && er.outcome?.calibratedWeightG == null && <p className="mt-1 text-sm text-muted">{calibrationLine(type)}</p>}
      {d !== null && (
        <div className="card-accent mt-2 p-3" data-next>
          <p className="eyebrow">Next time</p>
          <p className="text-base font-medium tabular-nums">
            {formatKg(d.nextG)} kg × {range.bottom}–{range.top}
          </p>
          <p className="text-sm text-muted">{REASON_LINES[d.reasonCode]}</p>
          {d.nextIsFirstExposure && <p className="text-sm text-muted">{FIRST_EXPOSURE_LINE}</p>}
        </div>
      )}
    </>
  );
}
