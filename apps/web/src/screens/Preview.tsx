import type { ProgramId } from "@liftly/catalog";
import { tailoredProgram, type TailoredPlan } from "@liftly/workout";
import { exerciseName } from "../gym";
import { EQUIPMENT_LABEL, planPreview } from "../plan";
import { Button, Note, Screen } from "../ui";

export interface PreviewAccount {
  readonly signedIn: boolean;
  readonly onCreate: () => void;
}

export interface PreviewAi {
  /** AI tailoring is allowed on this account. */
  readonly enabled: boolean;
  /** The AI has a real choice to make with the current answers. */
  readonly hasChoice: boolean;
  readonly busy: boolean;
  readonly note: string | null;
  readonly onAsk: () => void;
  readonly onEnable: () => void;
}

export interface PreviewTailoring {
  readonly plan: TailoredPlan | null;
  /** A workout is in progress: the plan cannot change until it ends. */
  readonly locked: boolean;
  readonly onTailor: () => void;
  readonly onStandard: () => void;
  readonly ai: PreviewAi | null;
}

const SOURCE_LABEL = { ai: "Chosen by AI, checked by Liftly", rules: "Built from your answers", fixed: "Standard plan" } as const;

function answerChips(plan: TailoredPlan): string[] {
  const a = plan.answers;
  const chips = a.unavailable.map((e) => `No ${EQUIPMENT_LABEL[e].toLowerCase()}s`);
  if (a.preference === "machines") chips.push("Prefers machines and cables");
  if (a.preference === "free_weights") chips.push("Prefers dumbbells and bodyweight");
  for (const id of a.avoid) chips.push(`Skip ${exerciseName(id)}`);
  return chips;
}

/** `account` is null when the app has no server configured; the preview then makes no mention of accounts. */
export function Preview({
  programId,
  onChangeProgram,
  account,
  tailoring,
  onContinue,
  onBack,
}: {
  readonly programId: ProgramId;
  readonly onChangeProgram: () => void;
  readonly account: PreviewAccount | null;
  /** Absent on the first-visit intro, where the standard plan is shown. */
  readonly tailoring?: PreviewTailoring;
  /** First visit: go on to the first workout. Absent when the plan is opened from Today. */
  readonly onContinue?: () => void;
  /** Opened from Today: go back. */
  readonly onBack?: () => void;
}) {
  const tp = tailoring?.plan ?? null;
  const plan = planPreview(programId, tp === null ? undefined : tailoredProgram(tp.programId, tp.picks));
  const fixedNames = new Map(planPreview(programId).workouts.flatMap((w) => w.exercises.map((e) => [`${w.key}|${e.order}`, e.name] as const)));
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
          {tailoring !== undefined && tp === null && (
            <Button variant="secondary" disabled={tailoring.locked} onClick={tailoring.onTailor}>
              Make it fit my gym
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
      {tailoring !== undefined && tp !== null && (
        <section className="card flex flex-col gap-3 p-4" aria-label="Made for your gym" data-tailored-card>
          <h2 className="text-lg font-semibold">Made for your gym</h2>
          <p className="text-sm text-muted" data-plan-source>
            {SOURCE_LABEL[tp.source]}
          </p>
          <p className="text-base" data-plan-explanation>
            {tp.explanation}
          </p>
          {answerChips(tp).length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Your answers">
              {answerChips(tp).map((c) => (
                <li key={c} className="pressed rounded-full px-3 py-1 text-sm">
                  {c}
                </li>
              ))}
            </ul>
          )}
          {tp.keptFixed.length > 0 && <p className="text-sm text-muted">Nothing allowed fit {tp.keptFixed.join(", ")}, so the standard exercise stays there.</p>}
          {tailoring.ai !== null && tp.source !== "ai" && tailoring.ai.hasChoice && (
            tailoring.ai.enabled ? (
              <Button variant="secondary" disabled={tailoring.ai.busy || tailoring.locked} onClick={tailoring.ai.onAsk}>
                {tailoring.ai.busy ? "Asking the AI…" : "Ask the AI to choose"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={tailoring.ai.onEnable}>
                Let an AI choose…
              </Button>
            )
          )}
          {tailoring.ai?.note != null && (
            <p className="text-sm text-muted" role="status" data-ai-note>
              {tailoring.ai.note}
            </p>
          )}
          {tailoring.locked && <p className="text-sm text-muted">Finish or discard your workout in progress to change the plan.</p>}
          <Button variant="secondary" disabled={tailoring.locked} onClick={tailoring.onTailor}>
            Change my answers
          </Button>
          <Button variant="secondary" disabled={tailoring.locked} onClick={tailoring.onStandard}>
            Back to the standard plan
          </Button>
        </section>
      )}
      <ol className="stagger flex flex-col gap-4" aria-label="Workouts">
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
                    <span className="text-sm text-muted">
                      {EQUIPMENT_LABEL[e.equipment]}
                      {tp !== null && fixedNames.get(`${w.key}|${e.order}`) !== e.name && <span data-changed> · Changed for you</span>}
                    </span>
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
