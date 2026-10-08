// Pain report (SAFETY.md). Fixed location list, fixed questions, fixed answers: no free text and nothing written by Claude.

import { LOCATION_LABEL, PAIN_LOCATIONS, PAIN_ON_SWAP_TEXT, PAIN_STOP_TEXT, SERIOUS_PAIN_TEXT, type PainInput, type PainLocation } from "@liftly/workout";
import { useState } from "react";
import { Button, Note, Screen } from "../ui";

export function PainReport({ exerciseName, onCancel, onSubmit }: { readonly exerciseName: string; readonly onCancel: () => void; readonly onSubmit: (input: Omit<PainInput, "id">) => void }) {
  const [location, setLocation] = useState<PainLocation | null>(null);
  const [severity, setSeverity] = useState<number | null>(null);
  const [rest, setRest] = useState<boolean | null>(null);
  const [odd, setOdd] = useState<boolean | null>(null);
  const ready = location !== null && severity !== null && rest !== null && odd !== null;
  const pill = (on: boolean) => `min-h-14 rounded-xl border px-3 text-base ${on ? "border-accent bg-accent-soft font-medium" : "border-line bg-surface"}`;
  return (
    <Screen
      title="Report pain"
      actions={
        <>
          <Button
            disabled={!ready}
            onClick={() => {
              if (ready) onSubmit({ location, severity, atRestOrNight: rest, numbnessTinglingSwellingInstability: odd });
            }}
          >
            Stop this exercise
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Back to exercise
          </Button>
        </>
      }
    >
      <p className="-mt-3 text-base text-muted">{exerciseName}. Pain is not the same as a hard set. If something hurts, stop.</p>
      <fieldset>
        <legend className="mb-2 text-base font-medium">Where does it hurt?</legend>
        <div className="grid grid-cols-2 gap-2">
          {PAIN_LOCATIONS.map((l) => (
            <button key={l} type="button" aria-pressed={location === l} data-location={l} onClick={() => setLocation(l)} className={pill(location === l)}>
              {LOCATION_LABEL[l]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-base font-medium">How strong is it? (0 none, 10 worst)</legend>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} type="button" aria-pressed={severity === n} aria-label={`Pain ${n} out of 10`} data-severity={n} onClick={() => setSeverity(n)} className={pill(severity === n)}>
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <YesNo legend="Does it hurt when you are resting, or at night?" value={rest} onChange={setRest} name="rest" pill={pill} />
      <YesNo legend="Any numbness, tingling, swelling, or the joint feeling unstable?" value={odd} onChange={setOdd} name="odd" pill={pill} />
    </Screen>
  );
}

function YesNo({ legend, value, onChange, name, pill }: { readonly legend: string; readonly value: boolean | null; readonly onChange: (v: boolean) => void; readonly name: string; readonly pill: (on: boolean) => string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-base font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={value === true} data-answer={`${name}-yes`} onClick={() => onChange(true)} className={pill(value === true)}>
          Yes
        </button>
        <button type="button" aria-pressed={value === false} data-answer={`${name}-no`} onClick={() => onChange(false)} className={pill(value === false)}>
          No
        </button>
      </div>
    </fieldset>
  );
}

export function PainResult({ onSwap, professionalHelp, onDone }: { readonly onSwap: boolean; readonly professionalHelp: boolean; readonly onDone: () => void }) {
  return (
    <Screen title="Exercise stopped" actions={<Button onClick={onDone}>Back to workout</Button>}>
      <Note tone="warn">
        <span data-pain-stop>{onSwap ? PAIN_ON_SWAP_TEXT : PAIN_STOP_TEXT}</span>
      </Note>
      {professionalHelp && (
        <Note tone="warn">
          <span data-professional-help>{SERIOUS_PAIN_TEXT}</span>
        </Note>
      )}
    </Screen>
  );
}
