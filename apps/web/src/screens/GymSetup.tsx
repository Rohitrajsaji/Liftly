// Gym weights (the load ladders). The user lists the weights their gym has for each kind of equipment; Liftly
// never assumes a step size. Every weight change the engine makes moves along this list.

import type { Equipment, ProgramId } from "@liftly/catalog";
import { formatKg } from "@liftly/workout";
import { useState } from "react";
import { EQUIPMENT_HELP, equipmentInUse, exerciseName, exercisesFor, ladderProblem, LADDER_PROBLEM_TEXT, mergeLadder, parseKg, rangeOf, startingLadder } from "../gym";
import { EQUIPMENT_LABEL } from "../plan";
import { Button, Note, Screen } from "../ui";

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
  const ladderOfKind = (e: Equipment): readonly number[] => {
    const ids = exercisesFor(programId, e).filter((id) => !custom.includes(id));
    return ladders[ids.find((id) => (ladders[id]?.length ?? 0) > 0) ?? ""] ?? [];
  };

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

  const missing = kinds.filter((k) => ladderOfKind(k).length === 0 && exercisesFor(programId, k).some((id) => (ladders[id]?.length ?? 0) === 0));
  return (
    <Screen
      title="Your gym's weights"
      actions={
        <Button onClick={onDone} disabled={missing.length > 0}>
          {missing.length > 0 ? "Add weights for each kind first" : "Done"}
        </Button>
      }
    >
      <p className="text-base text-muted">List the weights your gym has. Liftly only ever suggests a weight from your list.</p>
      {locked && <Note>You have a workout in progress. It keeps the weights it started with; changes apply from your next workout.</Note>}
      <ul className="flex flex-col gap-3" aria-label="Equipment">
        {kinds.map((k) => {
          const list = ladderOfKind(k);
          return (
            <li key={k} className="card p-4" data-equipment={k}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{String(kinds.indexOf(k) + 1).padStart(2, "0")}</p>
                  <h2 className="text-lg font-semibold">{EQUIPMENT_LABEL[k]}</h2>
                  <p className="text-sm text-muted">{EQUIPMENT_HELP[k]}</p>
                </div>
                <button type="button" onClick={() => setTarget({ kind: "equipment", equipment: k })} className="min-h-12 shrink-0 rounded-xl border border-line px-4 text-base font-medium text-accent">
                  {list.length > 0 ? "Edit" : "Add"}
                </button>
              </div>
              <p className="mt-2 text-base tabular-nums" data-ladder>
                {list.length > 0 ? `${list.map(formatKg).join(", ")} kg` : "Not set yet"}
              </p>
            </li>
          );
        })}
      </ul>
      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="min-h-12 cursor-pointer text-base font-medium">Different weights for one exercise</summary>
        <ul className="mt-2 divide-y divide-line">
          {kinds.flatMap((k) =>
            exercisesFor(programId, k).map((id) => (
              <li key={id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="block text-base">{exerciseName(id)}</span>
                  <span className="text-sm text-muted">{custom.includes(id) ? "Its own list" : `Uses the ${EQUIPMENT_LABEL[k].toLowerCase()} list`}</span>
                </span>
                <button type="button" onClick={() => setTarget({ kind: "exercise", exerciseId: id, equipment: k })} className="min-h-12 rounded-xl px-3 text-base font-medium text-accent underline">
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
  const input = "min-h-14 w-full rounded-xl border border-line bg-surface px-4 text-base";
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
      <ul className="flex flex-wrap gap-2" aria-label="Weights in kg" data-chips>
        {loads.length === 0 && <li className="text-base text-muted">No weights yet.</li>}
        {loads.map((g) => (
          <li key={g}>
            <button type="button" aria-label={`Remove ${formatKg(g)} kg`} onClick={() => setLoads(loads.filter((x) => x !== g))} className="min-h-12 rounded-full border border-line bg-surface px-4 text-base tabular-nums">
              {formatKg(g)} kg ×
            </button>
          </li>
        ))}
      </ul>
      <fieldset className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
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
      <fieldset className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
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
