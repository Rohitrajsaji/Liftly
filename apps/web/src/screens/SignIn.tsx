import { useState, type FormEvent } from "react";
import { BackendError } from "../backend";
import { Button, Note, Screen } from "../ui";

export function explain(e: unknown): string {
  const kind = e instanceof BackendError ? e.kind : "other";
  switch (kind) {
    case "offline":
      return "You're offline. Connect to the internet and try again.";
    case "rate_limited":
      return "Too many tries. Wait a minute, then ask for a new code.";
    case "bad_code":
      return "That code didn't work. Check it, or ask for a new one.";
    case "invalid_email":
      return "That email doesn't look right. Check it and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const field = "min-h-14 w-full rounded-xl border border-line bg-surface px-4 text-base text-ink";

export function EmailStep({ onBack, onSend }: { readonly onBack: () => void; readonly onSend: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = email.trim().toLowerCase();
  const valid = EMAIL_PATTERN.test(clean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(clean);
    } catch (err) {
      setError(explain(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col">
      <Screen
        title="What's your email?"
        actions={
          <>
            <Button type="submit" disabled={!valid || busy}>
              {busy ? "Sending…" : "Send me a code"}
            </Button>
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
          </>
        }
      >
        <p className="text-base text-muted">We'll email you a 6-digit code. No password to remember.</p>
        <label className="flex flex-col gap-2 text-base font-medium">
          Email
          <input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>
        {error !== null && (
          <Note tone="warn">
            <span role="alert">{error}</span>
          </Note>
        )}
      </Screen>
    </form>
  );
}

export function CodeStep({
  email,
  onBack,
  onResend,
  onVerify,
}: {
  readonly email: string;
  readonly onBack: () => void;
  readonly onResend: () => Promise<void>;
  readonly onVerify: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAgain, setSentAgain] = useState(false);
  const valid = /^\d{6}$/.test(code);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onVerify(code);
    } catch (err) {
      setError(explain(err));
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setSentAgain(false);
    try {
      await onResend();
      setSentAgain(true);
    } catch (err) {
      setError(explain(err));
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col">
      <Screen
        title="Enter your code"
        actions={
          <>
            <Button type="submit" disabled={!valid || busy}>
              {busy ? "Checking…" : "Check code"}
            </Button>
            <Button variant="secondary" onClick={() => void resend()}>
              Send a new code
            </Button>
            <Button variant="secondary" onClick={onBack}>
              Use a different email
            </Button>
          </>
        }
      >
        <p className="text-base text-muted">We sent a 6-digit code to {email}. It can take a minute to arrive.</p>
        <label className="flex flex-col gap-2 text-base font-medium">
          6-digit code
          <input
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={`${field} text-center text-2xl tracking-[0.4em] tabular-nums`}
          />
        </label>
        {sentAgain && <Note>A new code is on its way.</Note>}
        {error !== null && (
          <Note tone="warn">
            <span role="alert">{error}</span>
          </Note>
        )}
      </Screen>
    </form>
  );
}
