import { useState } from "react";
import { clampMonths, isBeyondBeginnerRange, MONTHS_MAX, MONTHS_MIN } from "../onboarding";
import { Button, Note, Screen } from "../ui";

const QUICK = [0, 3, 6, 12] as const;

export function Experience({ initial, onBack, onDone }: { readonly initial: number | null; readonly onBack: () => void; readonly onDone: (months: number) => void }) {
  const [months, setMonths] = useState(initial ?? 0);
  const set = (n: number) => setMonths(clampMonths(n));
  const label = months === 1 ? "month" : "months";
  return (
    <Screen
      title="How long have you been lifting?"
      actions={
        <>
          <Button onClick={() => onDone(months)}>Continue</Button>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </>
      }
    >
      <p className="text-base text-muted">Count the months of regular gym training. Zero is fine.</p>
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-3">
        <button type="button" aria-label="One month less" disabled={months <= MONTHS_MIN} onClick={() => set(months - 1)} className="size-16 rounded-xl bg-bg text-2xl font-medium disabled:opacity-40">
          −
        </button>
        <output aria-live="polite" className="text-center">
          <span className="block text-4xl font-semibold tabular-nums">{months}</span>
          <span className="text-base text-muted">{label}</span>
        </output>
        <button type="button" aria-label="One month more" disabled={months >= MONTHS_MAX} onClick={() => set(months + 1)} className="size-16 rounded-xl bg-bg text-2xl font-medium disabled:opacity-40">
          +
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Quick picks">
        {QUICK.map((n) => (
          <button key={n} type="button" aria-pressed={months === n} onClick={() => set(n)} className={`min-h-14 rounded-xl border text-base font-medium ${months === n ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
            {n}
          </button>
        ))}
      </div>
      {isBeyondBeginnerRange(months) && <Note tone="warn">Liftly is built for about your first 12 months of training. You can still continue.</Note>}
    </Screen>
  );
}
