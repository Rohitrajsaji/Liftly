// The workout in progress: the list of exercises with their status, and the finish button.

import { formatKg, type ExerciseRecord, type SessionRecord } from "@liftly/workout";
import { useNow, WorkoutProgress } from "../dots";
import { exerciseName } from "../gym";
import { Button, LinkButton, Note, Screen } from "../ui";
import { REP_RANGES } from "@liftly/engine";
import { exercise } from "@liftly/catalog";

const STATUS_TEXT: Record<ExerciseRecord["status"], string> = {
  pending: "Not started",
  in_progress: "In progress",
  done: "Done",
  stopped_pain: "Stopped (pain)",
  skipped: "Skipped",
};

export function targetOf(er: ExerciseRecord): string {
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
  const now = useNow(1000);
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
      <WorkoutProgress session={session} now={now} />
      <p className="-mt-2 text-base text-muted">
        {session.exercises.filter((e) => e.status === "done" || e.status === "stopped_pain").length} of {session.exercises.length} exercises done
      </p>
      <ol className="stagger flex flex-col gap-3" aria-label="Exercises" data-session-list>
        {session.exercises.map((er, i) => (
          <li key={er.slotOrder}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              data-exercise-row
              data-status={er.status}
              className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-3xl px-5 py-4 text-left ${i === nextIndex ? "pressed" : "raised"}`}
            >
              <span className="flex items-center gap-3">
                <StatusMark status={er.status} />
                <span>
                <span className="block text-base font-medium">{exerciseName(er.exerciseId)}</span>
                <span className="text-sm text-muted">{i === nextIndex && er.status === "pending" ? "Up next" : STATUS_TEXT[er.status]}</span>
                </span>
              </span>
              <span className="shrink-0 text-right text-base tabular-nums">{targetOf(er)}</span>
            </button>
          </li>
        ))}
      </ol>
      {accountPrompt !== null && anySet && (
        <Note>
          Your workout is saved on this phone. Create an account to keep it safe and use it on other devices.{" "}
          <LinkButton onClick={accountPrompt.onCreate}>Create account</LinkButton>
        </Note>
      )}
    </Screen>
  );
}

function StatusMark({ status }: { readonly status: ExerciseRecord["status"] }) {
  const done = status === "done";
  return (
    <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full text-sm transition-colors duration-500 ${done ? "bg-accent text-accent-ink" : status === "in_progress" ? "pressed text-accent" : "pressed text-muted"}`}>
      {done ? "✓" : status === "stopped_pain" || status === "skipped" ? "–" : status === "in_progress" ? "•" : ""}
    </span>
  );
}
