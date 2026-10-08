import type { ProgramId } from "@liftly/catalog";
import { EQUIPMENT_LABEL, planPreview } from "../plan";
import { Button, Note, Screen } from "../ui";

export function Preview({ programId, onChangeProgram }: { readonly programId: ProgramId; readonly onChangeProgram: () => void }) {
  const plan = planPreview(programId);
  return (
    <Screen
      title="Your plan"
      actions={
        <Button variant="secondary" onClick={onChangeProgram}>
          Change program
        </Button>
      }
    >
      <div>
        <p className="text-xl font-semibold">{plan.name}</p>
        <p className="text-lg text-muted">
          {plan.sessionsPerWeek} workouts a week, in this order: {plan.workouts.map((w) => w.key).join(" → ")}, then repeat.
        </p>
      </div>
      <Note>Your first session of each exercise finds your starting weight. Start light and go up one step at a time until a set feels Good.</Note>
      <ol className="flex flex-col gap-4" aria-label="Workouts">
        {plan.workouts.map((w) => (
          <li key={w.key} className="rounded-2xl border-2 border-line bg-surface p-4" data-workout={w.key}>
            <h2 className="flex items-baseline justify-between text-2xl font-bold">
              <span>{w.name}</span>
              <span className="text-base font-normal text-muted">{w.totalSets} sets</span>
            </h2>
            <ol className="mt-2 divide-y divide-line">
              {w.exercises.map((e) => (
                <li key={e.order} className="flex items-center justify-between gap-3 py-3" data-exercise>
                  <span>
                    <span className="block text-lg font-semibold" data-name>
                      {e.name}
                    </span>
                    <span className="text-base text-muted">{EQUIPMENT_LABEL[e.equipment]}</span>
                  </span>
                  <span className="shrink-0 text-right text-lg tabular-nums" data-target>
                    {e.sets} × {e.reps}
                  </span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <p className="text-base text-muted">"3 × 8–12" means 3 sets of 8 to 12 reps.</p>
      <Note>Next, you'll create an account so your workouts are saved. Account sign-in arrives in the next update; your answers are kept on this phone.</Note>
    </Screen>
  );
}
