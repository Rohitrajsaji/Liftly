import { useState } from "react";
import { DEBRIEF_CONSENT_POINTS, DEBRIEF_CONSENT_TITLE } from "../debrief";
import { Button, Note, Screen } from "../ui";
import { explain } from "./SignIn";

export function Account({
  email,
  pending,
  onBack,
  onSignOut,
  onDelete,
  claudeOn,
  onClaude,
}: {
  readonly email: string;
  readonly pending: number;
  readonly onBack: () => void;
  readonly onSignOut: () => Promise<void>;
  readonly onDelete: () => Promise<void>;
  readonly claudeOn: boolean;
  readonly onClaude: (on: boolean) => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(explain(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Account"
      actions={
        confirming ? (
          <>
            <Button disabled={busy} onClick={() => void run(onDelete)} className="bg-warn-ink! text-warn-soft!">
              {busy ? "Deleting…" : "Yes, delete my account and data"}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              Keep my account
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void run(onSignOut)}>
              Sign out
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              Delete account
            </Button>
          </>
        )
      }
    >
      <p className="text-base">
        Signed in as <span className="font-medium">{email}</span>
      </p>
      <p className="text-base text-muted" role="status">
        {pending === 0 ? "Everything is saved to your account." : `${pending} ${pending === 1 ? "change is" : "changes are"} waiting to sync. They upload when you're online.`}
      </p>
      {!confirming && (
        <section className="card flex flex-col gap-3 p-4" aria-label={DEBRIEF_CONSENT_TITLE}>
          <p className="text-base font-medium">{DEBRIEF_CONSENT_TITLE}</p>
          {claudeOn ? (
            <>
              <p className="text-base text-muted">On. After each workout Claude writes a short summary. Liftly's own rules still decide every weight.</p>
              <Button variant="secondary" disabled={busy} onClick={() => void run(() => onClaude(false))}>
                Turn off
              </Button>
            </>
          ) : asking ? (
            <>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted marker:text-accent">
                {DEBRIEF_CONSENT_POINTS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await onClaude(true);
                    setAsking(false);
                  })
                }
              >
                I agree, turn on
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setAsking(false)}>
                Not now
              </Button>
            </>
          ) : (
            <>
              <p className="text-base text-muted">Off. Workouts are summarised with fixed text and nothing is sent to Claude.</p>
              <Button variant="secondary" onClick={() => setAsking(true)}>
                Turn on…
              </Button>
            </>
          )}
        </section>
      )}
      {confirming && (
        <Note tone="warn">This permanently deletes your account and everything saved to it, and clears Liftly from this phone. It can't be undone.</Note>
      )}
      {error !== null && (
        <Note tone="warn">
          <span role="alert">{error}</span>
        </Note>
      )}
    </Screen>
  );
}
