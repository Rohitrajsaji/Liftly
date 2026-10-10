// After the workout: what was done and what comes next, straight from the engine's decision (PRD F13).

import { REP_RANGES } from "@liftly/engine";
import { exercise } from "@liftly/catalog";
import { calibrationLine, FIRST_EXPOSURE_LINE, formatKg, newRecords, sessionStats, PAIN_ON_SWAP_TEXT, PAIN_STOP_TEXT, REASON_LINES, workingSets, workingWeightLine, type ExerciseRecord, type SessionRecord } from "@liftly/workout";
import type { DebriefRecord } from "../db";
import { failureNote } from "../debrief";
import { Ring } from "../dots";
import { exerciseName } from "../gym";
import { Button, LinkButton, Note, Screen } from "../ui";

export function DebriefCard({ record, waiting, onRetry }: { readonly record: DebriefRecord | undefined; readonly waiting: boolean; /** Set when AI summaries are on: shows why the fixed text is shown, and a Try again button. */ readonly onRetry?: (() => void) | undefined }) {
  if (record === undefined) return null;
  const note = onRetry !== undefined && !waiting ? failureNote(record) : null;
  return (
    <section key={waiting ? "waiting" : record.source} className="card-accent fade-in p-4" aria-label="Workout summary" data-debrief={waiting ? "waiting" : record.source}>
      <p className="eyebrow">{record.source === "claude" ? "Summary by AI" : "Summary"}</p>
      {waiting ? (
        <div role="status" aria-label="Writing your summary" className="mt-2 flex flex-col gap-2" data-debrief-waiting>
          <span className="sr-only">Writing your summary…</span>
          <span className="shimmer block h-3.5 w-full rounded-full" />
          <span className="shimmer block h-3.5 w-11/12 rounded-full" />
          <span className="shimmer block h-3.5 w-3/5 rounded-full" />
          <span className="mt-1 text-sm text-muted">Writing your summary…</span>
        </div>
      ) : (
        <p className="mt-1 text-base leading-relaxed" role="status">
          {record.text}
        </p>
      )}
      {note !== null && (
        <div className="mt-2 text-sm text-muted" data-debrief-note>
          <p>{note.text}</p>
          {note.detail !== null && <p className="mt-1 break-words opacity-80">({note.detail})</p>}
          <LinkButton onClick={onRetry}>Try again</LinkButton>
        </div>
      )}
    </section>
  );
}

export function Summary({
  session,
  sessions,
  onHome,
  accountPrompt,
  debrief,
  waiting,
  onRetry,
  onOfferAi,
}: {
  readonly session: SessionRecord;
  /** Every finished workout, this one included, to spot new records. */
  readonly sessions: readonly SessionRecord[];
  readonly onHome: () => void;
  readonly accountPrompt: { readonly onCreate: () => void } | null;
  readonly debrief: DebriefRecord | undefined;
  readonly waiting: boolean;
  readonly onRetry?: (() => void) | undefined;
  /** Signed in with AI summaries off: a way to turn them on. */
  readonly onOfferAi?: (() => void) | undefined;
}) {
  const done = session.exercises.filter((e) => e.status === "done").length;
  const stats = sessionStats(session);
  const records = newRecords(sessions, session);
  const volumeKg = Math.round(stats.volumeG / 1000);
  return (
    <Screen title={session.completion === "full" ? "Workout complete" : "Workout saved"} actions={<Button onClick={onHome}>Done</Button>}>
      <section className="card flex items-center gap-5 p-5" aria-label="Today's workout in numbers" data-summary-stats>
        <Ring value={done / Math.max(1, session.exercises.length)} accent size={104} stroke={9}>
          <p className="text-2xl font-semibold tabular-nums">
            {done}/{session.exercises.length}
          </p>
          <p className="text-xs text-muted">exercises</p>
        </Ring>
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="Time" value={stats.minutes === null ? "–" : `${stats.minutes} min`} />
          <Stat label="Sets" value={String(stats.sets)} />
          <Stat label="Reps" value={String(stats.reps)} />
          <Stat label="Lifted" value={`${volumeKg.toLocaleString("en-IN")} kg`} />
        </dl>
      </section>
      <p className="sr-only" data-summary-count>
        {done} of {session.exercises.length} exercises done.
      </p>
      {records.length > 0 && (
        <section className="card-accent rise p-4" aria-label="New records" data-new-records>
          <p className="eyebrow">{records.length === 1 ? "New record" : `${records.length} new records`}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {records.map((r) => (
              <li key={r.exerciseId} className="flex justify-between gap-3 text-base">
                <span className="font-medium">{exerciseName(r.exerciseId)}</span>
                <span className="tabular-nums">
                  {formatKg(r.weightG)} kg × {r.reps}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <DebriefCard record={debrief} waiting={waiting} onRetry={onRetry} />
      {onOfferAi !== undefined && (
        <LinkButton onClick={onOfferAi} className="-mt-2 self-start text-sm" data-offer-ai>
          Want a written summary from AI? Turn it on in Account
        </LinkButton>
      )}
      <ol className="stagger flex flex-col gap-3" aria-label="Results">
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
          <LinkButton onClick={accountPrompt.onCreate}>Create an account to back it up</LinkButton>
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

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
