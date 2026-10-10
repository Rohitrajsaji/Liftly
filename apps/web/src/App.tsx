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
import { targetOf, Workout } from "./screens/Workout";
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
import { LinkButton, MotionContext, type MotionDir } from "./ui";
import { exerciseName as exerciseNameOf } from "./gym";

type View = "onboarding" | "consent" | "auth" | "account";
// Gym setup used to mark the plan intro as done; with standard gym weights nothing is saved, so remember it here.
const INTRO_KEY = "liftly.introSeen";
function introSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}
function markIntroSeen(seen = true): void {
  try {
    if (seen) localStorage.setItem(INTRO_KEY, "1");
    else localStorage.removeItem(INTRO_KEY);
  } catch {
    // Private mode: the intro shows again after a reload, which is harmless.
  }
}

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
  const backRef = useRef<(() => void) | null>(null);
  const pushed = useRef(false);
  // Motion direction for the next screen change: set just before navigating; anything unset counts as forward.
  const pendingDir = useRef<MotionDir | null>(null);
  const shown = useRef<{ key: string; dir: MotionDir }>({ key: "", dir: "fade" });
  const skipPop = useRef(false);
  const hasBackRef = useRef(false);
  // After every render: keep one history entry while a screen has a Back, so the phone's back gesture steps back in the app.
  useEffect(() => {
    if (hasBackRef.current && !pushed.current) {
      history.pushState({ liftly: true }, "");
      pushed.current = true;
    } else if (!hasBackRef.current && pushed.current) {
      // Reached a top-level screen by a button: drop the extra history entry so the phone's back doesn't do nothing once.
      pushed.current = false;
      skipPop.current = true;
      history.back();
    }
  });
  useEffect(() => {
    const onPop = () => {
      if (skipPop.current) {
        skipPop.current = false;
        return;
      }
      pushed.current = false;
      pendingDir.current = "back";
      backRef.current?.();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
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
    // A new screen starts at the top, header included; focusing the title must not scroll it away.
    window.scrollTo({ top: 0 });
    main.current?.querySelector<HTMLElement>("[data-screen-title]")?.focus({ preventScroll: true });
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
  /** Wraps an action that goes back, so the next screen slides in from the left. */
  const goingBack =
    <A extends unknown[]>(fn: (...a: A) => void) =>
    (...a: A) => {
      pendingDir.current = "back";
      fn(...a);
    };
  const onboarded = isOnboarded(profile) && profile.step === "preview" && profile.programId !== null;
  const where: Screen | "intro" = screen ?? (workout.hasProgress || introSeen() ? "home" : "intro");
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

  // One place decides what "back" means on every screen. The header arrow, the on-screen Back buttons' siblings and the
  // phone's own back gesture all use it, so going back never leaves the app by surprise.
  const backAction: (() => void) | null = (() => {
    if (view === "consent" || view === "auth" || view === "account") return () => setView("onboarding");
    if (profile.step === "experience" || profile.step === "program") return () => update(back(profile));
    if (!onboarded) return null;
    switch (where) {
      case "gym":
      case "plan":
      case "workout":
        return () => setScreen("home");
      case "exercise":
      case "pain_result":
        return () => setScreen("workout");
      case "pain":
        return () => setScreen("exercise");
      case "summary":
        return () => {
          workout.leaveSummary();
          setScreen("home");
        };
      default:
        return null;
    }
  })();
  backRef.current = backAction;
  hasBackRef.current = backAction !== null;
  const goBack = () => {
    pendingDir.current = "back";
    if (pushed.current) history.back();
    else backRef.current?.();
  };
  // Each screen gets a key; a new key restarts its entrance animation in the direction it was reached.
  const screenKey = `${view}|${profile.step}|${onboarded ? where : "-"}|${where === "exercise" ? exIndex : ""}`;
  if (shown.current.key !== screenKey) {
    shown.current = { key: screenKey, dir: shown.current.key === "" ? "fade" : (pendingDir.current ?? "forward") };
    pendingDir.current = null;
  }
  const inWorkout = where === "workout" || where === "exercise" || where === "pain" || where === "pain_result" || where === "summary" || where === "gym";

  const accountButton =
    backend === null || view !== "onboarding" || (onboarded && inWorkout) ? null : (
      <button
        type="button"
        onClick={() => setView(session === null ? "consent" : "account")}
        aria-label={session === null ? "Sign in" : "Account"}
        data-account-button
        className="raised grid size-12 place-items-center rounded-full text-ink"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 19.5c1.4-3.2 4-4.8 7-4.8s5.6 1.6 7 4.8" />
        </svg>
        {session !== null && <span aria-hidden="true" className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-accent" />}
      </button>
    );

  return (
    <div className="app-frame mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-clip px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex min-h-14 items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {/* The back arrow has a fixed slot, so the name never jumps sideways when it appears. */}
          <span className="grid size-12 place-items-center">
            {backAction !== null && (
              <button type="button" onClick={goBack} aria-label="Previous screen" data-back className="raised grid size-12 place-items-center rounded-full text-ink fade-in">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
            )}
            {backAction === null && <img src="/icon.svg" alt="" aria-hidden="true" className="size-9 rounded-xl" />}
          </span>
          <span className="text-xl font-semibold tracking-tight">Liftly</span>
        </span>
        <span className="flex items-center gap-2">
          {!online && (
            <span role="status" className="pressed rounded-full px-3 py-1 text-sm text-muted fade-in">
              Offline
            </span>
          )}
          {session !== null && pending > 0 && (
            <span role="status" className="pressed rounded-full px-3 py-1 text-sm text-muted fade-in" data-sync-pending>
              Waiting to sync
            </span>
          )}
          {install !== null && view === "onboarding" && !inWorkout && <LinkButton onClick={install}>Install app</LinkButton>}
          {accountButton !== null && <span className="relative">{accountButton}</span>}
        </span>
      </header>
      {view === "onboarding" && onboarded && workout.ready && (where === "home" || where === "progress" || where === "history") && (
        <nav aria-label="Sections" className="pressed mt-1 grid grid-cols-3 gap-1 rounded-full p-1">
          {(["home", "progress", "history"] as const).map((t) => (
            <button key={t} type="button" aria-current={where === t ? "page" : undefined} onClick={() => {
                if (t === where) return;
                pendingDir.current = "fade";
                setScreen(t);
              }} className={`min-h-12 rounded-full text-base ${where === t ? "raised font-medium text-accent" : "text-muted"}`}>
              {t === "home" ? "Today" : t === "progress" ? "Progress" : "History"}
            </button>
          ))}
        </nav>
      )}
      <main ref={main} className="flex flex-1 flex-col pt-4">
        <MotionContext.Provider value={shown.current.dir}>
        <div key={screenKey} className="flex flex-1 flex-col">
        {view === "consent" && (
          <Consent
            onBack={goingBack(() => setView("onboarding"))}
            onAccept={() => {
              void recordConsent(db, new Date()).then(() => setView("auth"));
            }}
          />
        )}
        {view === "auth" && backend !== null && (
          <AuthStep
            onBack={goingBack(() => setView("onboarding"))}
            onSubmit={async (mode, email, password) =>
              finishSignIn(mode === "create" ? await backend.signUp(email, password) : await backend.signIn(email, password))
            }
          />
        )}
        {view === "account" && backend !== null && session !== null && (
          <Account
            email={session.email}
            pending={pending}
            onBack={goingBack(() => setView("onboarding"))}
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
              markIntroSeen(false);
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
          <Experience initial={profile.monthsTraining} onBack={goingBack(() => update(back(profile)))} onDone={(m) => update(next({ ...profile, monthsTraining: m }))} />
        )}
        {view === "onboarding" && profile.step === "program" && (
          <ProgramChoice initial={profile.programId} onBack={goingBack(() => update(back(profile)))} onDone={(id) => update(next({ ...profile, programId: id }))} />
        )}
        {view === "onboarding" && onboarded && profile.programId !== null && where === "intro" && (
          <Preview programId={profile.programId} onChangeProgram={() => update(changeProgram(profile))} account={account} onContinue={() => {
            markIntroSeen();
            setScreen("home");
          }} />
        )}
        {view === "onboarding" && onboarded && profile.programId !== null && where === "plan" && (
          <Preview programId={profile.programId} onChangeProgram={() => update(changeProgram(profile))} account={account} onBack={goingBack(() => setScreen("home"))} />
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
            start={
              workout.data.state.sessionsDone === 0
                ? { gymDone: workout.missingLadders.length === 0, accountDone: session !== null, accountAvailable: backend !== null, onAccount: () => setView("consent") }
                : null
            }
            onStart={() => {
              // Straight into the first exercise; the list stays one tap away.
              const started = workout.start();
              const first = started?.exercises.findIndex((e) => e.status === "pending") ?? -1;
              if (first >= 0) {
                setExIndex(first);
                setScreen("exercise");
              } else setScreen("workout");
            }}
            onContinue={() => setScreen("workout")}
            onGym={() => setScreen("gym")}
            onPlan={() => setScreen("plan")}
            onAnswer={(id, still) => void workout.answerFollowUp(id, still)}
          />
        )}
        {view === "onboarding" && onboarded && workout.ready && where === "progress" && workout.ctx !== null && <Progress sessions={workout.data.sessions} programId={workout.ctx.programId} plan={workout.plan} />}
        {view === "onboarding" && onboarded && workout.ready && workout.ctx !== null && where === "history" && <History sessions={workout.data.sessions} programId={workout.ctx.programId} debriefs={debriefs.records} onRetry={claudeOn ? (id) => void debriefs.retry(id) : undefined} />}
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
            onList={goingBack(() => setScreen("workout"))}
            onNext={nextOpen(exIndex) === null ? null : () => setExIndex(nextOpen(exIndex) ?? exIndex)}
            upNext={(() => {
              const n = nextOpen(exIndex);
              const er = n === null ? undefined : workout.active.exercises[n];
              return er === undefined ? null : { name: exerciseNameOf(er.exerciseId), target: targetOf(er) };
            })()}
            onPain={() => setScreen("pain")}
          />
        )}
        {view === "onboarding" && onboarded && workout.active !== null && workout.ctx !== null && where === "pain" && (
          <PainReport
            exerciseName={exerciseNameOf(workout.active.exercises[exIndex]?.exerciseId ?? "")}
            onCancel={goingBack(() => setScreen("exercise"))}
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
            sessions={workout.data.sessions}
            accountPrompt={accountPrompt}
            debrief={debriefs.records[workout.finished.id]}
            waiting={debriefs.waiting.has(workout.finished.id)}
            onRetry={claudeOn ? () => void debriefs.retry(workout.finished?.id ?? "") : undefined}
            onOfferAi={
              backend !== null && session !== null && !claudeOn
                ? () => {
                    workout.leaveSummary();
                    setScreen("home");
                    setView("account");
                  }
                : undefined
            }
            onHome={() => {
              workout.leaveSummary();
              setScreen("home");
            }}
          />
        )}
        </div>
        </MotionContext.Provider>
      </main>
    </div>
  );
}
