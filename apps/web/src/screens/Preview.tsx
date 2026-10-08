import type { ProgramId } from "@liftly/catalog";
import { EQUIPMENT_LABEL, planPreview } from "../plan";
import { Button, Note, Screen } from "../ui";

export interface PreviewAccount {
  readonly signedIn: boolean;
  readonly onCreate: () => void;
}

/** `account` is null when the app has no server configured; the preview then makes no mention of accounts. */
export function Preview({
  programId,
  onChangeProgram,
  account,
  onContinue,
  onBack,
}: {
  readonly programId: ProgramId;
  readonly onChangeProgram: () => void;
  readonly account: PreviewAccount | null;
  /** First visit: go on to the first workout. Absent when the plan is opened from Today. */
  readonly onContinue?: () => void;
  /** Opened from Today: go back. */
  readonly onBack?: () => void;
}) {
  const plan = planPreview(programId);
  return (
    <Screen
      title="Your plan"
      actions={
        <>
          {onContinue !== undefined && <Button onClick={onContinue}>Continue to your first workout</Button>}
          {onBack !== undefined && <Button onClick={onBack}>Back to today</Button>}
          {account !== null && !account.signedIn && (
            <Button variant={onContinue === undefined ? "primary" : "secondary"} onClick={account.onCreate}>
              Create account to save your plan
            </Button>
          )}
          <Button variant="secondary" onClick={onChangeProgram}>
            Change program
          </Button>
        </>
      }
    >
      <div>
        <p className="text-lg font-medium">{plan.name}</p>
        <p className="text-base text-muted">
          Goal: build muscle. {plan.sessionsPerWeek} workouts a week, in this order: {plan.workouts.map((w) => w.key).join(" → ")}, then repeat.
        </p>
      </div>
      <Note>Your first session of each exercise finds your starting weight. Start light and go up one step at a time until a set feels Good.</Note>
      <ol className="flex flex-col gap-4" aria-label="Workouts">
        {plan.workouts.map((w) => (
          <li key={w.key} className="card p-4" data-workout={w.key}>
            <h2 className="flex items-baseline justify-between text-lg font-semibold">
              <span>{w.name}</span>
              <span className="text-sm font-normal text-muted">{w.totalSets} sets</span>
            </h2>
            <ol className="mt-2 divide-y divide-line">
              {w.exercises.map((e) => (
                <li key={e.order} className="flex items-center justify-between gap-3 py-3" data-exercise>
                  <span>
                    <span className="block text-base font-medium" data-name>
                      {e.name}
                    </span>
                    <span className="text-sm text-muted">{EQUIPMENT_LABEL[e.equipment]}</span>
                  </span>
                  <span className="shrink-0 text-right text-base tabular-nums" data-target>
                    {e.sets} × {e.reps}
                  </span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">"3 × 8–12" means 3 sets of 8 to 12 reps.</p>
      {account?.signedIn === true && <Note>Your plan is saved to your account.</Note>}
      {account !== null && !account.signedIn && <Note>Create an account to save your plan and your workouts. You can look around first.</Note>}
    </Screen>
  );
}
