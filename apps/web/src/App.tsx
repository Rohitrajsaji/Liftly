import { exerciseState, reportPain, type PainInput } from "@liftly/workout";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attachToAccount, recordConsent, syncProfileChange } from "./account";
import type { Backend, Session } from "./backend";
import { SUPABASE } from "./config";
import { LiftlyDb, loadProfile, saveProfile, wipeLocalData } from "./db";
import { back, changeProgram, isOnboarded, next, NEW_PROFILE, stampStartDate, type Profile } from "./onboarding";
import { Account } from "./screens/Account";
import { Consent } from "./screens/Consent";
import { Exercise } from "./screens/Exercise";
import { GymSetup } from "./screens/GymSetup";
import { History } from "./screens/History";
import { Home, dueFollowUps } from "./screens/Home";
import { Progress } from "./screens/Progress";
import { PainReport, PainResult } from "./screens/Pain";
import { Summary } from "./screens/Summary";
import { Workout } from "./screens/Workout";
import { Experience } from "./screens/Experience";
import { Preview } from "./screens/Preview";
import { ProgramChoice } from "./screens/ProgramChoice";
import { AuthStep } from "./screens/SignIn";
import { claudeDebriefOn, setClaudeDebrief } from "./debrief";
import { useDebriefs } from "./useDebriefs";
import { Welcome } from "./screens/Welcome";
import { useInstallPrompt, useOnline } from "./shell";
import { createSupabaseBackend } from "./supabaseBackend";
import { flushOutbox, pendingCount } from "./sync";

import { useWorkout } from "./useWorkout";
import { exerciseName as exerciseNameOf } from "./gym";

type View = "onboarding" | "consent" | "auth" | "account";
/** Where the user is inside the app once onboarded. */
type Screen = "home" | "progress" | "history" | "gym" | "plan" | "workout" | "exercise" | "pain" | "pain_result" | "summary";

const db = new LiftlyDb();
const backend: Backend | null = SUPABASE === null ? null : createSupabaseBackend(SUPABASE.url, SUPABASE.key);

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("onboarding");
  const [pending, setPending] = useState(0);
  const online = useOnline();
  const [claudeOn, setClaudeOn] = useState(false);
  const install = useInstallPrompt();
  const main = useRef<HTMLElement>(null);
  const joining = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    void claudeDebriefOn(db).then(setClaudeOn);
  }, [session, reloadKey]);
  const [screen, setScreen] = useState<Screen | "intro" | null>(null);
  const [exIndex, setExIndex] = useState(0);
  const [painOutcome, setPainOutcome] = useState<{ onSwap: boolean; professionalHelp: boolean } | null>(null);

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
            setReloadKey((k) => k + 1);
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
    sessionRef.current = session;
  }, [session]);

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
  }, [profile?.step, view, screen, exIndex]);

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

  const onSaved = useCallback(() => {
    void flush(sessionRef.current);
  }, [flush]);
  const workout = useWorkout(db, profile ?? NEW_PROFILE, session, onSaved, reloadKey);
  const debriefs = useDebriefs(db, backend, claudeOn ? session : null, profile ?? NEW_PROFILE, workout.data.sessions, workout.finished, online);

  if (profile === null) return null;
  const onboarded = isOnboarded(profile) && profile.step === "preview" && profile.programId !== null;
  const where: Screen | "intro" = screen ?? (workout.hasProgress ? "home" : "intro");
  const accountPrompt = backend !== null && session === null ? { onCreate: () => setView("consent") } : null;
  const nextOpen = (from: number): number | null => {
    const list = workout.active?.exercises ?? [];
    for (let k = 1; k <= list.length; k++) {
      const i = (from + k) % list.length;
      if (i !== from && (list[i]?.status === "pending" || list[i]?.status === "in_progress")) return i;
    }
    return null;
  };

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
            <span role="status" className="pressed rounded-full px-3 py-1 text-sm text-muted">
              Offline
            </span>
          )}
          {session !== null && pending > 0 && (
            <span role="status" className="pressed rounded-full px-3 py-1 text-sm text-muted" data-sync-pending>
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
      {view === "onboarding" && onboarded && workout.ready && (where === "home" || where === "progress" || where === "history") && (
        <nav aria-label="Sections" className="pressed mt-1 grid grid-cols-3 gap-1 rounded-full p-1">
          {(["home", "progress", "history"] as const).map((t) => (
            <button key={t} type="button" aria-current={where === t ? "page" : undefined} onClick={() => setScreen(t)} className={`min-h-12 rounded-full text-base ${where === t ? "raised font-medium text-accent" : "text-muted"}`}>
              {t === "home" ? "Today" : t === "progress" ? "Progress" : "History"}
            </button>
          ))}
        </nav>
      )}
      <main ref={main} className="flex flex-1 flex-col pb-4 pt-4">
        {view === "consent" && (
          <Consent
            onBack={() => setView("onboarding")}
            onAccept={() => {
              void recordConsent(db, new Date()).then(() => setView("auth"));
            }}
          />
        )}
        {view === "auth" && backend !== null && (
          <AuthStep
            onBack={() => setView("onboarding")}
            onSubmit={async (mode, email, password) =>
              finishSignIn(mode === "create" ? await backend.signUp(email, password) : await backend.signIn(email, password))
            }
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
            claudeOn={claudeOn}
            onClaude={async (on) => {
              await setClaudeDebrief(db, backend, session, on, new Date());
              setClaudeOn(await claudeDebriefOn(db));
              await debriefs.refresh();
            }}
            onDelete={async () => {
              await backend.deleteAccount();
              await wipeLocalData(db);
              setSession(null);
              setPending(0);
              setProfile(NEW_PROFILE);
              setScreen(null);
              setReloadKey((k) => k + 1);
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
        {view === "onboarding" && onboarded && profile.programId !== null && where === "intro" && (
          <Preview programId={profile.programId} onChangeProgram={() => update(changeProgram(profile))} account={account} onContinue={() => setScreen("home")} />
        )}
        {view === "onboarding" && onboarded && profile.programId !== null && where === "plan" && (
          <Preview programId={profile.programId} onChangeProgram={() => update(changeProgram(profile))} account={account} onBack={() => setScreen("home")} />
        )}
        {view === "onboarding" && onboarded && workout.ready && workout.ctx !== null && where === "home" && workout.finished === null && (
          <Home
            plan={workout.plan}
            planError={workout.missingLadders.length > 0 ? null : workout.planError}
            missingGym={workout.missingLadders.length > 0}
            active={workout.active}
            followUps={dueFollowUps(workout.data.state.openFollowUps, new Date())}
            lastDone={workout.lastDone}
            workoutName={workout.workoutName}
            onStart={() => {
              workout.start();
              setScreen("workout");
            }}
            onContinue={() => setScreen("workout")}
            onGym={() => setScreen("gym")}
            onPlan={() => setScreen("plan")}
            onAnswer={(id, still) => void workout.answerFollowUp(id, still)}
          />
        )}
        {view === "onboarding" && onboarded && workout.ready && where === "progress" && <Progress sessions={workout.data.sessions} />}
        {view === "onboarding" && onboarded && workout.ready && workout.ctx !== null && where === "history" && <History sessions={workout.data.sessions} programId={workout.ctx.programId} debriefs={debriefs.records} />}
        {view === "onboarding" && onboarded && workout.ctx !== null && where === "gym" && (
          <GymSetup
            programId={workout.ctx.programId}
            ladders={workout.data.ladders}
            custom={workout.data.custom}
            locked={workout.active !== null}
            onSave={workout.saveGym}
            onDone={() => setScreen("home")}
          />
        )}
        {view === "onboarding" && onboarded && workout.active !== null && where === "workout" && (
          <Workout
            session={workout.active}
            workoutName={workout.workoutName}
            accountPrompt={accountPrompt}
            onOpen={(i) => {
              setExIndex(i);
              setScreen("exercise");
            }}
            onFinish={() => {
              void workout.finish().then(() => setScreen("summary"));
            }}
            onDiscard={() => {
              void workout.discard().then(() => setScreen("home"));
            }}
          />
        )}
        {view === "onboarding" && onboarded && workout.active !== null && where === "exercise" && (
          <Exercise
            session={workout.active}
            index={exIndex}
            previous={exerciseState(workout.data.state, workout.active.exercises[exIndex]?.exerciseId ?? "").lastPerformance}
            onUpdate={workout.update}
            onList={() => setScreen("workout")}
            onNext={nextOpen(exIndex) === null ? null : () => setExIndex(nextOpen(exIndex) ?? exIndex)}
            onPain={() => setScreen("pain")}
          />
        )}
        {view === "onboarding" && onboarded && workout.active !== null && workout.ctx !== null && where === "pain" && (
          <PainReport
            exerciseName={exerciseNameOf(workout.active.exercises[exIndex]?.exerciseId ?? "")}
            onCancel={() => setScreen("exercise")}
            onSubmit={(input) => {
              const cur = workout.active;
              const ctx = workout.ctx;
              if (cur === null || ctx === null) return;
              const result = reportPain(cur, exIndex, workout.data.state, ctx, { pain: { ...input, id: crypto.randomUUID() } satisfies PainInput, now: new Date() });
              workout.update(() => result.session);
              setPainOutcome({ onSwap: result.record.onSwap, professionalHelp: result.showProfessionalHelp });
              setScreen("pain_result");
            }}
          />
        )}
        {view === "onboarding" && onboarded && where === "pain_result" && painOutcome !== null && (
          <PainResult onSwap={painOutcome.onSwap} professionalHelp={painOutcome.professionalHelp} onDone={() => setScreen("workout")} />
        )}
        {view === "onboarding" && onboarded && where === "summary" && workout.finished !== null && (
          <Summary
            session={workout.finished}
            accountPrompt={accountPrompt}
            debrief={debriefs.records[workout.finished.id]}
            waiting={debriefs.waiting.has(workout.finished.id)}
            onHome={() => {
              workout.leaveSummary();
              setScreen("home");
            }}
          />
        )}
      </main>
    </div>
  );
}
