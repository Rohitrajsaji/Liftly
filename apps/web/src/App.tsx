import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attachToAccount, recordConsent, syncProfileChange } from "./account";
import type { Backend, Session } from "./backend";
import { SUPABASE } from "./config";
import { LiftlyDb, loadProfile, saveProfile, wipeLocalData } from "./db";
import { back, changeProgram, next, NEW_PROFILE, stampStartDate, type Profile } from "./onboarding";
import { Account } from "./screens/Account";
import { Consent } from "./screens/Consent";
import { Experience } from "./screens/Experience";
import { Preview } from "./screens/Preview";
import { ProgramChoice } from "./screens/ProgramChoice";
import { CodeStep, EmailStep } from "./screens/SignIn";
import { Welcome } from "./screens/Welcome";
import { useInstallPrompt, useOnline } from "./shell";
import { createSupabaseBackend } from "./supabaseBackend";
import { flushOutbox, pendingCount } from "./sync";

type View = "onboarding" | "consent" | "email" | "code" | "account";

const db = new LiftlyDb();
const backend: Backend | null = SUPABASE === null ? null : createSupabaseBackend(SUPABASE.url, SUPABASE.key);

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("onboarding");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(0);
  const online = useOnline();
  const install = useInstallPrompt();
  const main = useRef<HTMLElement>(null);
  const joining = useRef(false);

  const refreshPending = useCallback(async (s: Session | null) => {
    setPending(s === null ? 0 : await pendingCount(db, s.userId));
  }, []);

  // Upload anything waiting. Safe to call at any time: uploads are idempotent and one run at a time.
  // If sign-in succeeded but joining the account was cut short (no connection), a consent is still held on the
  // device: finish that first.
  const flush = useCallback(
    async (s: Session | null) => {
      if (backend === null || s === null) return;
      try {
        if ((await db.consent.count()) > 0) {
          if (joining.current) return;
          joining.current = true;
          try {
            const result = await attachToAccount(db, backend, s, new Date());
            if (result.adopted !== null) setProfile(result.adopted);
          } finally {
            joining.current = false;
          }
        } else {
          await flushOutbox(db, backend, s.userId);
        }
      } catch {
        // Offline or the server is down: everything stays queued and is retried when the connection returns.
      }
      await refreshPending(s);
    },
    [refreshPending],
  );

  useEffect(() => {
    void (async () => {
      setProfile(await loadProfile(db));
      if (backend === null) return;
      // The session is read from the device, so this works offline.
      const s = await backend.getSession().catch(() => null);
      setSession(s);
      await flush(s);
    })();
  }, [flush]);

  // Back online: upload what was saved while offline.
  useEffect(() => {
    if (online) void flush(session);
  }, [online, session, flush]);

  // Move focus to the new screen's heading so screen readers announce it.
  useEffect(() => {
    main.current?.querySelector<HTMLElement>("[data-screen-title]")?.focus();
  }, [profile?.step, view]);

  const update = useCallback(
    (p: Profile) => {
      const stamped = stampStartDate(p, new Date());
      setProfile(stamped);
      void saveProfile(db, stamped).then(async () => {
        if (backend !== null && session !== null) {
          await syncProfileChange(db, backend, session, stamped, new Date());
          await refreshPending(session);
        }
      });
    },
    [session, refreshPending],
  );

  const account = useMemo(
    () => (backend === null ? null : { signedIn: session !== null, onCreate: () => setView("consent") }),
    [session],
  );

  if (profile === null) return null;

  const finishSignIn = async (s: Session) => {
    if (backend === null) return;
    // Signed in from here on, even if joining the account below is cut short; flush() finishes it later.
    setSession(s);
    setView("onboarding");
    await flush(s);
  };

  const accountButton =
    backend === null || view !== "onboarding" ? null : (
      <button type="button" onClick={() => setView(session === null ? "consent" : "account")} className="min-h-12 rounded-xl px-3 text-base font-medium text-accent underline">
        {session === null ? "Sign in" : "Account"}
      </button>
    );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex min-h-14 items-center justify-between gap-3">
        <span className="text-xl font-semibold tracking-tight">Liftly</span>
        <span className="flex items-center gap-2">
          {!online && (
            <span role="status" className="rounded-full border border-line px-3 py-1 text-sm text-muted">
              Offline
            </span>
          )}
          {session !== null && pending > 0 && (
            <span role="status" className="rounded-full border border-line px-3 py-1 text-sm text-muted" data-sync-pending>
              Waiting to sync
            </span>
          )}
          {install !== null && view === "onboarding" && (
            <button type="button" onClick={install} className="min-h-12 rounded-xl px-3 text-base font-medium text-accent underline">
              Install app
            </button>
          )}
          {accountButton}
        </span>
      </header>
      <main ref={main} className="flex flex-1 flex-col pb-4 pt-4">
        {view === "consent" && (
          <Consent
            onBack={() => setView("onboarding")}
            onAccept={() => {
              void recordConsent(db, new Date()).then(() => setView("email"));
            }}
          />
        )}
        {view === "email" && backend !== null && (
          <EmailStep
            onBack={() => setView("onboarding")}
            onSend={async (e) => {
              await backend.sendCode(e);
              setEmail(e);
              setView("code");
            }}
          />
        )}
        {view === "code" && backend !== null && (
          <CodeStep
            email={email}
            onBack={() => setView("email")}
            onResend={() => backend.sendCode(email)}
            onVerify={async (code) => finishSignIn(await backend.verifyCode(email, code))}
          />
        )}
        {view === "account" && backend !== null && session !== null && (
          <Account
            email={session.email}
            pending={pending}
            onBack={() => setView("onboarding")}
            onSignOut={async () => {
              await backend.signOut();
              setSession(null);
              setPending(0);
              setView("onboarding");
            }}
            onDelete={async () => {
              await backend.deleteAccount();
              await wipeLocalData(db);
              setSession(null);
              setPending(0);
              setProfile(NEW_PROFILE);
              setView("onboarding");
            }}
          />
        )}
        {view === "onboarding" && profile.step === "welcome" && <Welcome onStart={() => update(next(profile))} />}
        {view === "onboarding" && profile.step === "experience" && (
          <Experience initial={profile.monthsTraining} onBack={() => update(back(profile))} onDone={(m) => update(next({ ...profile, monthsTraining: m }))} />
        )}
        {view === "onboarding" && profile.step === "program" && (
          <ProgramChoice initial={profile.programId} onBack={() => update(back(profile))} onDone={(id) => update(next({ ...profile, programId: id }))} />
        )}
        {view === "onboarding" && profile.step === "preview" && profile.programId !== null && (
          <Preview programId={profile.programId} onChangeProgram={() => update(changeProgram(profile))} account={account} />
        )}
      </main>
    </div>
  );
}
