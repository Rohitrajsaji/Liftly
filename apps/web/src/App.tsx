import { useCallback, useEffect, useRef, useState } from "react";
import { LiftlyDb, loadProfile, saveProfile } from "./db";
import { back, changeProgram, next, type Profile } from "./onboarding";
import { Experience } from "./screens/Experience";
import { Preview } from "./screens/Preview";
import { ProgramChoice } from "./screens/ProgramChoice";
import { Welcome } from "./screens/Welcome";
import { useInstallPrompt, useOnline } from "./shell";

const db = new LiftlyDb();

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const online = useOnline();
  const install = useInstallPrompt();
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    void loadProfile(db).then(setProfile);
  }, []);

  // Move focus to the new screen's heading so screen readers announce it.
  useEffect(() => {
    main.current?.querySelector<HTMLElement>("[data-screen-title]")?.focus();
  }, [profile?.step]);

  const update = useCallback((p: Profile) => {
    setProfile(p);
    void saveProfile(db, p);
  }, []);

  if (profile === null) return null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex min-h-14 items-center justify-between gap-3">
        <span className="text-xl font-bold tracking-tight">Liftly</span>
        <span className="flex items-center gap-2">
          {!online && (
            <span role="status" className="rounded-full border border-line px-3 py-1 text-sm text-muted">
              Offline
            </span>
          )}
          {install !== null && (
            <button type="button" onClick={install} className="min-h-12 rounded-xl px-3 text-base font-semibold text-accent underline">
              Install app
            </button>
          )}
        </span>
      </header>
      <main ref={main} className="flex flex-1 flex-col pb-4 pt-4">
        {profile.step === "welcome" && <Welcome onStart={() => update(next(profile))} />}
        {profile.step === "experience" && (
          <Experience initial={profile.monthsTraining} onBack={() => update(back(profile))} onDone={(m) => update(next({ ...profile, monthsTraining: m }))} />
        )}
        {profile.step === "program" && (
          <ProgramChoice initial={profile.programId} onBack={() => update(back(profile))} onDone={(id) => update(next({ ...profile, programId: id }))} />
        )}
        {profile.step === "preview" && profile.programId !== null && <Preview programId={profile.programId} onChangeProgram={() => update(changeProgram(profile))} />}
      </main>
    </div>
  );
}
