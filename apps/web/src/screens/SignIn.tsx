import { useState, type FormEvent } from "react";
import { BackendError } from "../backend";
import { Button, Note, Screen } from "../ui";

export function explain(e: unknown): string {
  const kind = e instanceof BackendError ? e.kind : "other";
  switch (kind) {
    case "offline":
      return "You're offline. Connect to the internet and try again.";
    case "rate_limited":
      return "Too many tries. Wait a minute and try again.";
    case "bad_password":
      return "That email or password isn't right. Check them and try again.";
    case "exists":
      return "There's already an account for this email. Sign in instead.";
    case "weak_password":
      return "That password is too easy to guess. Use at least 8 characters.";
    case "confirm_required":
      return "Your account was created, but the sign-in needs your email confirmed first. Check your inbox, then sign in.";
    case "invalid_email":
      return "That email doesn't look right. Check it and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const field = "pressed min-h-14 w-full rounded-2xl px-4 text-base text-ink";

export const MIN_PASSWORD = 8;

/** Create an account or sign in, with an email and a password. */
export function AuthStep({ onBack, onSubmit }: { readonly onBack: () => void; readonly onSubmit: (mode: "create" | "signin", email: string, password: string) => Promise<void> }) {
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = email.trim().toLowerCase();
  const valid = EMAIL_PATTERN.test(clean) && password.length >= (mode === "create" ? MIN_PASSWORD : 1);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(mode, clean, password);
    } catch (err) {
      setError(explain(err));
      setBusy(false);
    }
  };

  const tab = (m: "create" | "signin") => `min-h-12 rounded-full text-base ${mode === m ? "raised font-medium text-accent" : "text-muted"}`;
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col">
      <Screen
        title={mode === "create" ? "Create your account" : "Sign in"}
        actions={
          <>
            <Button type="submit" disabled={!valid || busy}>
              {busy ? "One moment…" : mode === "create" ? "Create account" : "Sign in"}
            </Button>
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
          </>
        }
      >
        <div role="group" aria-label="Account" className="pressed grid grid-cols-2 gap-1 rounded-full p-1">
          <button type="button" aria-pressed={mode === "create"} onClick={() => setMode("create")} className={tab("create")}>
            New here
          </button>
          <button type="button" aria-pressed={mode === "signin"} onClick={() => setMode("signin")} className={tab("signin")}>
            I have an account
          </button>
        </div>
        <label className="flex flex-col gap-2 text-base font-medium">
          Email
          <input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-2 text-base font-medium">
          Password
          <input
            type={show ? "text" : "password"}
            name="password"
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            autoCapitalize="none"
            spellCheck={false}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex min-h-12 items-center gap-3 text-base">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-6" />
          Show password
        </label>
        {mode === "create" && <p className="text-sm text-muted">At least {MIN_PASSWORD} characters. Keep it somewhere safe: there is no password reset yet.</p>}
        {error !== null && (
          <Note tone="warn">
            <span role="alert">{error}</span>
          </Note>
        )}
      </Screen>
    </form>
  );
}
