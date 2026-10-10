// Gym weights (the load ladders). The user lists the weights their gym has for each kind of equipment; Liftly
// never assumes a step size. Every weight change the engine makes moves along this list.

import type { Equipment, ProgramId } from "@liftly/catalog";
import { formatKg } from "@liftly/workout";
import { useState } from "react";
import { EQUIPMENT_HELP, equipmentInUse, exerciseName, exercisesFor, ladderProblem, LADDER_PROBLEM_TEXT, mergeLadder, parseKg, rangeOf, STANDARD_LADDERS, startingLadder } from "../gym";
import { EQUIPMENT_LABEL } from "../plan";
import { Button, LinkButton, Note, Screen } from "../ui";

type Target = { readonly kind: "equipment"; readonly equipment: Equipment } | { readonly kind: "exercise"; readonly exerciseId: string; readonly equipment: Equipment };

export interface GymSetupProps {
  readonly programId: ProgramId;
  readonly ladders: Readonly<Record<string, readonly number[]>>;
  readonly custom: readonly string[];
  readonly onSave: (rows: { exerciseId: string; loadsG: readonly number[] }[], custom: boolean) => Promise<void>;
  readonly onDone: () => void;
  /** A workout in progress keeps the weights it started with. */
  readonly locked: boolean;
}

export function GymSetup({ programId, ladders, custom, onSave, onDone, locked }: GymSetupProps) {
  const [target, setTarget] = useState<Target | null>(null);
  const kinds = equipmentInUse(programId);
  const savedOfKind = (e: Equipment): readonly number[] => {
    const ids = exercisesFor(programId, e).filter((id) => !custom.includes(id));
    return ladders[ids.find((id) => (ladders[id]?.length ?? 0) > 0) ?? ""] ?? [];
  };
  const ladderOfKind = (e: Equipment): readonly number[] => (savedOfKind(e).length > 0 ? savedOfKind(e) : STANDARD_LADDERS[e]);

  if (target !== null) {
    const ids = target.kind === "equipment" ? exercisesFor(programId, target.equipment).filter((id) => !custom.includes(id)) : [target.exerciseId];
    const initial = target.kind === "equipment" ? ladderOfKind(target.equipment) : (ladders[target.exerciseId] ?? ladderOfKind(target.equipment));
    return (
      <LadderEditor
        title={target.kind === "equipment" ? `${EQUIPMENT_LABEL[target.equipment]} weights` : exerciseName(target.exerciseId)}
        equipment={target.equipment}
        initial={initial.length > 0 ? initial : startingLadder(target.equipment)}
        onCancel={() => setTarget(null)}
        onSave={async (loadsG) => {
          await onSave(ids.map((exerciseId) => ({ exerciseId, loadsG })), target.kind === "exercise");
          setTarget(null);
        }}
      />
    );
  }

  return (
    <Screen title="Your gym's weights" actions={<Button onClick={onDone}>Done</Button>}>
      <p className="text-base text-muted">Liftly starts with the weights most gyms have. If yours are different, change a list and Liftly will only suggest weights from it.</p>
      {locked && <Note>You have a workout in progress. It keeps the weights it started with; changes apply from your next workout.</Note>}
      <ul className="flex flex-col gap-3" aria-label="Equipment">
        {kinds.map((k) => {
          const list = ladderOfKind(k);
          return (
            <li key={k} className="card p-4" data-equipment={k}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    {EQUIPMENT_LABEL[k]}
                    {savedOfKind(k).length === 0 && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent" data-standard>Standard</span>}
                  </h2>
                  <p className="text-sm text-muted">{EQUIPMENT_HELP[k]}</p>
                </div>
                <button type="button" onClick={() => setTarget({ kind: "equipment", equipment: k })} className="raised min-h-12 shrink-0 rounded-full px-5 text-base font-medium text-accent">
                  Edit
                </button>
              </div>
              <p className="mt-2 text-base tabular-nums" data-ladder>
                {summaryOf(list)}
              </p>
            </li>
          );
        })}
      </ul>
      <details className="card p-4">
        <summary className="min-h-12 cursor-pointer text-base font-medium">Different weights for one exercise</summary>
        <ul className="mt-2 divide-y divide-line">
          {kinds.flatMap((k) =>
            exercisesFor(programId, k).map((id) => (
              <li key={id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="block text-base">{exerciseName(id)}</span>
                  <span className="text-sm text-muted">{custom.includes(id) ? "Its own list" : `Uses the ${EQUIPMENT_LABEL[k].toLowerCase()} list`}</span>
                </span>
                <button type="button" onClick={() => setTarget({ kind: "exercise", exerciseId: id, equipment: k })} className="min-h-12 text-base font-medium text-accent underline underline-offset-4">
                  Edit
                </button>
              </li>
            )),
          )}
        </ul>
      </details>
    </Screen>
  );
}

/** Long lists read better as a range: "2.5 to 50 kg, every 2.5 kg". */
function summaryOf(list: readonly number[]): string {
  const first = list[0];
  const last = list.at(-1);
  if (first === undefined || last === undefined) return "Not set yet";
  const gaps = new Set(list.slice(1).map((g, i) => g - (list[i] ?? 0)));
  const gap = [...gaps][0];
  if (list.length > 6 && gaps.size === 1 && gap !== undefined) return `${formatKg(first)} to ${formatKg(last)} kg, every ${formatKg(gap)} kg`;
  if (list.length > 6 && first === 0 && gaps.size === 2) return `Bodyweight, then ${formatKg(list[1] ?? 0)} to ${formatKg(last)} kg`;
  return `${list.map(formatKg).join(", ")} kg`;
}

function LadderEditor({ title, equipment, initial, onSave, onCancel }: { readonly title: string; readonly equipment: Equipment; readonly initial: readonly number[]; readonly onSave: (loadsG: number[]) => Promise<void>; readonly onCancel: () => void }) {
  const [loads, setLoads] = useState<number[]>([...initial].sort((a, b) => a - b));
  const [single, setSingle] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addSingle = () => {
    const g = parseKg(single);
    if (g === null) return setError("Enter a weight in kg, like 12.5.");
    setLoads(mergeLadder(loads, [g]));
    setSingle("");
    setError(null);
  };
  const addRange = () => {
    const f = parseKg(from);
    const t = parseKg(to);
    const s = parseKg(step);
    const r = f === null || t === null || s === null ? null : rangeOf(f, t, s);
    if (r === null) return setError("Enter a start, an end and a step in kg. The end must be at least the start.");
    setLoads(mergeLadder(loads, r));
    setFrom("");
    setTo("");
    setStep("");
    setError(null);
  };
  const problem = ladderProblem(loads, equipment);
  const save = async () => {
    if (problem !== null) return setError(LADDER_PROBLEM_TEXT[problem]);
    setBusy(true);
    try {
      await onSave(loads);
    } finally {
      setBusy(false);
    }
  };
  const input = "pressed min-h-14 w-full rounded-2xl px-4 text-base";
  return (
    <Screen
      title={title}
      actions={
        <>
          <Button disabled={busy} onClick={() => void save()}>
            Save weights
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </>
      }
    >
      {loads.length > 0 && (
        <div className="-mt-2 flex justify-end">
          <LinkButton onClick={() => setLoads(equipment === "bodyweight" ? [0] : [])}>Clear list</LinkButton>
        </div>
      )}
      <ul className="flex flex-wrap gap-2" aria-label="Weights in kg" data-chips>
        {loads.length === 0 && <li className="text-base text-muted">No weights yet.</li>}
        {loads.map((g) => (
          <li key={g}>
            <button type="button" aria-label={`Remove ${formatKg(g)} kg`} onClick={() => setLoads(loads.filter((x) => x !== g))} className="raised min-h-12 rounded-full px-4 text-base tabular-nums">
              {formatKg(g)} kg ×
            </button>
          </li>
        ))}
      </ul>
      <fieldset className="card flex flex-col gap-2 p-4">
        <legend className="px-1 text-base font-medium">Add a range</legend>
        <p className="text-sm text-muted">For a stack that goes 5, 10, 15 … 60: start 5, end 60, step 5.</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-sm text-muted">
            Start (kg)
            <input inputMode="decimal" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
          </label>
          <label className="text-sm text-muted">
            End (kg)
            <input inputMode="decimal" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
          </label>
          <label className="text-sm text-muted">
            Step (kg)
            <input inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} className={input} />
          </label>
        </div>
        <Button variant="secondary" onClick={addRange}>
          Add range
        </Button>
      </fieldset>
      <fieldset className="card flex flex-col gap-2 p-4">
        <legend className="px-1 text-base font-medium">Add one weight</legend>
        <label className="text-sm text-muted">
          Weight (kg)
          <input inputMode="decimal" value={single} onChange={(e) => setSingle(e.target.value)} className={input} />
        </label>
        <Button variant="secondary" onClick={addSingle}>
          Add weight
        </Button>
      </fieldset>
      {error !== null && (
        <Note tone="warn">
          <span role="alert">{error}</span>
        </Note>
      )}
    </Screen>
  );
}
