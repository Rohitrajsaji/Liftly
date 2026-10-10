// After the workout: what was done and what comes next, straight from the engine's decision (PRD F13).

import { REP_RANGES } from "@liftly/engine";
import { exercise } from "@liftly/catalog";
import { calibrationLine, FIRST_EXPOSURE_LINE, formatKg, PAIN_ON_SWAP_TEXT, PAIN_STOP_TEXT, REASON_LINES, workingSets, workingWeightLine, type ExerciseRecord, type SessionRecord } from "@liftly/workout";
import type { DebriefRecord } from "../db";
import { ProgressDots } from "../dots";
import { exerciseName } from "../gym";
import { Button, Note, Screen } from "../ui";

export function DebriefCard({ record, waiting }: { readonly record: DebriefRecord | undefined; readonly waiting: boolean }) {
  if (record === undefined) return null;
  return (
    <section className="card-accent p-4" aria-label="Workout summary" data-debrief={waiting ? "waiting" : record.source}>
      <p className="eyebrow">{record.source === "claude" ? "Summary by Claude" : "Summary"}</p>
      <p className="mt-1 text-base" role="status">
        {waiting ? "Writing your summary…" : record.text}
      </p>
    </section>
  );
}

export function Summary({
  session,
  onHome,
  accountPrompt,
  debrief,
  waiting,
}: {
  readonly session: SessionRecord;
  readonly onHome: () => void;
  readonly accountPrompt: { readonly onCreate: () => void } | null;
  readonly debrief: DebriefRecord | undefined;
  readonly waiting: boolean;
}) {
  const done = session.exercises.filter((e) => e.status === "done").length;
  return (
    <Screen title={session.completion === "full" ? "Workout complete" : "Workout saved"} actions={<Button onClick={onHome}>Done</Button>}>
      <div className="-mt-2 flex items-center justify-between">
        <p className="text-base text-muted" data-summary-count>
          {done} of {session.exercises.length} exercises done.
        </p>
        <ProgressDots done={done} total={session.exercises.length} />
      </div>
      <DebriefCard record={debrief} waiting={waiting} />
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
          <p className="text-sm font-medium text-muted">Next time</p>
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
