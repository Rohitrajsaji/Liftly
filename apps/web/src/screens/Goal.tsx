import { Button, Screen } from "../ui";

export function Goal({ onBack, onConfirm }: { readonly onBack: () => void; readonly onConfirm: () => void }) {
  return (
    <Screen
      title="Your goal: build muscle"
      actions={
        <>
          <Button onClick={onConfirm}>Yes, build muscle</Button>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </>
      }
    >
      <p className="text-lg text-muted">
        Liftly's plans are for building muscle in a standard gym, using machines, cables and dumbbells.
      </p>
    </Screen>
  );
}
