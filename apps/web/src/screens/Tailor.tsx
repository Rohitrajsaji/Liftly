import type { Equipment, ProgramId } from "@liftly/catalog";
import { avoidableExercises, type Preference, type TailorAnswers } from "@liftly/workout";
import { useState } from "react";
import { exerciseName } from "../gym";
import { EQUIPMENT_LABEL } from "../plan";
import { Button, Screen } from "../ui";

const EQUIPMENT: readonly Equipment[] = ["machine", "cable", "dumbbell"];
const PREFERENCES: readonly { readonly value: Preference; readonly label: string; readonly hint: string }[] = [
  { value: "none", label: "No preference", hint: "Keep the standard exercises where they fit." },
  { value: "machines", label: "Machines and cables", hint: "Use these first where there is a choice." },
  { value: "free_weights", label: "Dumbbells and bodyweight", hint: "Use these first where there is a choice." },
];

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** The few questions behind plan tailoring. Everything is optional; the plan is built from the answers on the device. */
export function Tailor({ programId, initial, onBack, onDone }: { readonly programId: ProgramId; readonly initial: TailorAnswers; readonly onBack: () => void; readonly onDone: (a: TailorAnswers) => void }) {
  const [unavailable, setUnavailable] = useState<readonly Equipment[]>(initial.unavailable);
  const [preference, setPreference] = useState<Preference>(initial.preference);
  const [avoid, setAvoid] = useState<readonly string[]>(initial.avoid);
  const avoidable = avoidableExercises(programId);
  const box = (on: boolean) => `flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-base ${on ? "pressed" : "raised"}`;
  return (
    <Screen
      title="Make the plan fit your gym"
      actions={
        <>
          <Button onClick={() => onDone({ unavailable, preference, avoid })}>Build my plan</Button>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </>
      }
    >
      <p className="text-base text-muted">Answer what you like, or skip. Liftly only swaps an exercise for an approved alternative in the same place in the workout. Sets and reps stay the same.</p>
      <section className="flex flex-col gap-3" aria-label="Equipment your gym doesn't have">
        <h2 className="text-lg font-semibold">What does your gym not have?</h2>
        {EQUIPMENT.map((e) => {
          const on = unavailable.includes(e);
          return (
            <button key={e} type="button" role="checkbox" aria-checked={on} className={box(on)} onClick={() => setUnavailable(toggle(unavailable, e))}>
              <span>{EQUIPMENT_LABEL[e]}s</span>
              <span className="text-sm text-muted">{on ? "Not available" : "Available"}</span>
            </button>
          );
        })}
      </section>
      <section className="flex flex-col gap-3" role="radiogroup" aria-label="Preference">
        <h2 className="text-lg font-semibold">What do you prefer?</h2>
        {PREFERENCES.map((p) => (
          <button key={p.value} type="button" role="radio" aria-checked={preference === p.value} className={box(preference === p.value)} onClick={() => setPreference(p.value)}>
            <span>
              <span className="block">{p.label}</span>
              <span className="block text-sm text-muted">{p.hint}</span>
            </span>
          </button>
        ))}
      </section>
      <section className="flex flex-col gap-3" aria-label="Exercises to avoid">
        <h2 className="text-lg font-semibold">Any exercise you'd rather skip?</h2>
        {avoidable.map((id) => {
          const on = avoid.includes(id);
          return (
            <button key={id} type="button" role="checkbox" aria-checked={on} className={box(on)} onClick={() => setAvoid(toggle(avoid, id))}>
              <span>{exerciseName(id)}</span>
              <span className="text-sm text-muted">{on ? "Skip" : ""}</span>
            </button>
          );
        })}
      </section>
    </Screen>
  );
}
