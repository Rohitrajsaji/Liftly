// The workout in progress: the list of exercises with their status, and the finish button.

import { formatKg, type ExerciseRecord, type SessionRecord } from "@liftly/workout";
import { ProgressDots } from "../dots";
import { exerciseName } from "../gym";
import { Button, Note, Screen } from "../ui";
import { REP_RANGES } from "@liftly/engine";
import { exercise } from "@liftly/catalog";

const STATUS_TEXT: Record<ExerciseRecord["status"], string> = {
  pending: "Not started",
  in_progress: "In progress",
  done: "Done",
  stopped_pain: "Stopped (pain)",
  skipped: "Skipped",
};

function targetOf(er: ExerciseRecord): string {
  const range = REP_RANGES[exercise(er.exerciseId).type ?? "compound"];
  const w = er.prescription.kind === "working" ? `${formatKg(er.workingWeightG ?? er.prescription.weightG)} kg × ` : "";
  return `${w}${er.targetSets} × ${range.bottom}–${range.top}`;
}

export function Workout({
  session,
  workoutName,
  onOpen,
  onFinish,
  onDiscard,
  accountPrompt,
}: {
  readonly session: SessionRecord;
  readonly workoutName: string;
  readonly onOpen: (index: number) => void;
  readonly onFinish: () => void;
  readonly onDiscard: () => void;
  readonly accountPrompt: { readonly onCreate: () => void } | null;
}) {
  const anySet = session.exercises.some((e) => e.sets.length > 0 || e.status === "stopped_pain");
  const nextIndex = session.exercises.findIndex((e) => e.status === "pending" || e.status === "in_progress");
  const allClosed = nextIndex === -1;
  return (
    <Screen
      title={workoutName}
      actions={
        anySet ? (
          <Button onClick={onFinish} variant={allClosed ? "primary" : "secondary"}>
            Finish workout
          </Button>
        ) : (
          <Button variant="secondary" onClick={onDiscard}>
            Cancel workout
          </Button>
        )
      }
    >
      <div className="-mt-2 flex items-center justify-between">
        <span className="text-base text-muted">{session.exercises.filter((e) => e.status === "done" || e.status === "stopped_pain").length} of {session.exercises.length} done</span>
        <ProgressDots done={session.exercises.filter((e) => e.status === "done" || e.status === "stopped_pain").length} total={session.exercises.length} />
      </div>
      <ol className="card divide-y divide-line overflow-hidden" aria-label="Exercises" data-session-list>
        {session.exercises.map((er, i) => (
          <li key={er.slotOrder}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              data-exercise-row
              data-status={er.status}
              className={`flex min-h-16 w-full items-center justify-between gap-3 border-l-4 p-4 text-left ${i === nextIndex ? "border-accent bg-accent-soft" : "border-transparent"}`}
            >
              <span>
                <span className="block text-base font-medium">{exerciseName(er.exerciseId)}</span>
                <span className="text-sm text-muted">{STATUS_TEXT[er.status]}</span>
              </span>
              <span className="shrink-0 text-right text-base tabular-nums">{targetOf(er)}</span>
            </button>
          </li>
        ))}
      </ol>
      {accountPrompt !== null && anySet && (
        <Note>
          Your workout is saved on this phone. Create an account to keep it safe and use it on other devices.{" "}
          <button type="button" onClick={accountPrompt.onCreate} className="min-h-12 font-medium text-accent underline">
            Create account
          </button>
        </Note>
      )}
    </Screen>
  );
}
