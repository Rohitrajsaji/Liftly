import { CONSENT_POINTS, CONSENT_TITLE } from "../consent";
import { Button, Screen } from "../ui";

export function Consent({ onAccept, onBack }: { readonly onAccept: () => void; readonly onBack: () => void }) {
  return (
    <Screen
      title={CONSENT_TITLE}
      actions={
        <>
          <Button onClick={onAccept}>I agree and continue</Button>
          <Button variant="secondary" onClick={onBack}>
            Not now
          </Button>
        </>
      }
    >
      <ul className="flex list-disc flex-col gap-3 pl-5 text-base text-muted marker:text-accent">
        {CONSENT_POINTS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </Screen>
  );
}
