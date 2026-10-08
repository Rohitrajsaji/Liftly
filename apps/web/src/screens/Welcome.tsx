import { DotFace } from "../dots";
import { Button, Screen } from "../ui";

export function Welcome({ onStart }: { readonly onStart: () => void }) {
  return (
    <Screen title="Know what to lift next" eyebrow="Liftly · Beginner muscle plan" actions={<Button onClick={onStart}>Get started</Button>}>
      <DotFace mood="happy" size={120} className="mx-auto text-ink" />
      <p className="text-base text-muted">
        Liftly gives you a beginner plan for building muscle and tells you the weight and reps for every set.
      </p>
      <p className="text-base text-muted">Your goal: build muscle. Answer two questions to see your plan. You don't need an account yet.</p>
    </Screen>
  );
}
