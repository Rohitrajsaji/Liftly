import { PROGRAMS, type ProgramId } from "@liftly/catalog";
import { useState } from "react";
import { Button, Screen } from "../ui";

const ORDER: readonly ProgramId[] = ["3-day", "4-day"];

function sequenceText(id: ProgramId): string {
  const p = PROGRAMS[id];
  return p.sequence.map((k) => p.slots.find((s) => s.key === k)?.name ?? k).join(", ");
}

export function ProgramChoice({ initial, onBack, onDone }: { readonly initial: ProgramId | null; readonly onBack: () => void; readonly onDone: (id: ProgramId) => void }) {
  const [choice, setChoice] = useState<ProgramId | null>(initial);
  return (
    <Screen
      title="How many days a week can you train?"
      actions={
        <>
          <Button disabled={choice === null} onClick={() => choice !== null && onDone(choice)}>
            Continue
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Program" className="flex flex-col gap-3">
        {ORDER.map((id) => {
          const p = PROGRAMS[id];
          const selected = choice === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(id)}
              className={`min-h-24 rounded-3xl p-5 text-left ${selected ? "pressed" : "raised"}`}
            >
              <span className="block text-lg font-semibold">{p.sessionsPerWeek} days a week</span>
              <span className="block text-base">{p.name}</span>
              <span className="block text-sm text-muted">{sequenceText(id)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-base text-muted">Workouts go in order, not by weekday. If you miss a day, you just do the next one.</p>
    </Screen>
  );
}
