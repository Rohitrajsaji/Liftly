import { Button, Screen } from "../ui";

export function Welcome({ onStart }: { readonly onStart: () => void }) {
  return (
    <Screen title="Know what to lift next" actions={<Button onClick={onStart}>Get started</Button>}>
      <p className="text-lg text-muted">
        Liftly gives you a beginner plan for building muscle and tells you the weight and reps for every set.
      </p>
      <p className="text-lg text-muted">Answer three questions to see your plan. You don't need an account yet.</p>
    </Screen>
  );
}
