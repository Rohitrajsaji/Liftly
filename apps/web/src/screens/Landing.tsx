// The website: what Liftly is, how it works, and how to put it on a phone. Shown in a normal browser; the installed
// home-screen app skips it (see mode.ts). Same soft look as the app. No claims beyond what the app really does.

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { chooseBrowserUse, detectPlatform, type Platform } from "../mode";
import { useInstallPrompt } from "../shell";
import { Demo } from "./Demo";

const FEATURES: readonly { readonly title: string; readonly text: string }[] = [
  { title: "Tells you the weight", text: "Before every set you see the exact weight and reps to aim for. After the workout it works out your next target." },
  { title: "Uses your gym's real weights", text: "You enter the weights your gym actually has. Liftly only ever suggests a weight you can load." },
  { title: "Made for beginners", text: "A simple 3 or 4 day plan to build muscle. One tap tells it how hard each set felt: Easy, Good, Hard or Failed." },
  { title: "Works without signal", text: "Log your workout in a basement gym with no internet. It saves on your phone and syncs when you're back online." },
];

const STEPS: readonly { readonly title: string; readonly text: string }[] = [
  { title: "Answer two questions", text: "How long you've trained and how many days a week you can come. You get your plan straight away." },
  { title: "Set your gym's weights", text: "Takes about a minute, once." },
  { title: "Lift and tap", text: "Do each set, tap how it felt. Liftly handles the numbers." },
  { title: "See what's next", text: "Your next weights are ready the moment you finish. Progress and history are always one tap away." },
];

const INSTALL: Readonly<Record<"ios" | "android", { readonly name: string; readonly steps: readonly string[] }>> = {
  ios: {
    name: "iPhone or iPad",
    steps: ["Open liftly.space in Safari.", "Tap the Share button (the square with an arrow).", "Scroll down and tap Add to Home Screen, then Add.", "Open Liftly from your home screen. That is the app."],
  },
  android: {
    name: "Android",
    steps: ["Open liftly.space in Chrome.", "Tap the three dots menu at the top right.", "Tap Install app (or Add to Home screen), then Install.", "Open Liftly from your home screen. That is the app."],
  },
};

// Sections and cards fade up as they scroll into view. Without IntersectionObserver or with reduced motion
// nothing is hidden, so the page is always fully readable.
function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (el === null || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    el.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    items.forEach((i) => io.observe(i));
    return () => {
      io.disconnect();
      el.classList.remove("js-reveal");
    };
  }, [root]);
}

// Smooth-scroll to a section and give it a short highlight so the eye lands on it.
function goTo(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (target === null) return;
  e.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
  target.classList.remove("section-flash");
  void target.offsetWidth;
  target.classList.add("section-flash");
}

export function Landing({ onUseInBrowser }: { readonly onUseInBrowser: () => void }) {
  const install = useInstallPrompt();
  const detected: Platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const [choice, setChoice] = useState<"ios" | "android" | "both">(detected === "other" ? "both" : detected);
  const shown: readonly ("ios" | "android")[] = choice === "both" ? ["ios", "android"] : [choice];
  const onPhone = detected !== "other";
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  const useInBrowser = () => {
    chooseBrowserUse();
    onUseInBrowser();
  };

  return (
    <div ref={rootRef} className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-14 px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] md:gap-20 md:px-8" data-landing>
      <header className="flex min-h-14 items-center justify-between">
        <span className="text-xl font-semibold tracking-tight">Liftly</span>
        <a href="#install" onClick={(e) => goTo(e, "install")} className="raised grid min-h-12 place-items-center rounded-full px-5 text-base font-medium text-accent">
          Get the app
        </a>
      </header>

      <section className="stagger grid items-center gap-10 md:grid-cols-2" aria-labelledby="hero">
        <div className="flex flex-col gap-5">
          <p className="eyebrow">For beginners building muscle</p>
          <h1 id="hero" className="text-4xl font-semibold leading-tight md:text-5xl">
            Know what to lift next.
          </h1>
          <p className="text-lg text-muted">
            Liftly is a simple gym companion. It gives you a beginner plan, tells you the weight and reps for every set, and works out your next weights after each workout.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href="#install" onClick={(e) => goTo(e, "install")} className="grid min-h-14 place-items-center rounded-full bg-accent px-7 text-base font-medium text-accent-ink shadow-[6px_6px_12px_var(--shadow-dark),-6px_-6px_12px_var(--shadow-light)]">
              {onPhone ? "Add Liftly to your phone" : "How to get the app"}
            </a>
            {install !== null && (
              <button type="button" onClick={install} className="raised min-h-14 rounded-full px-7 text-base font-medium">
                Install now
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-xs" aria-hidden="true">
          <div className="card float-slow flex flex-col gap-4 p-5">
            <p className="eyebrow">Today</p>
            <p className="text-xl font-semibold">Workout A</p>
            <div className="pressed rounded-3xl p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="text-base font-medium">Leg Press</span>
                <span className="text-base tabular-nums">60 kg × 3 × 8–12</span>
              </div>
              <p className="mt-1 text-sm text-muted">You reached the top of the range, so the weight goes up one step.</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              {["Easy", "Good", "Hard", "Failed"].map((l, i) => (
                <span key={l} className={`min-h-12 rounded-full py-3 ${i === 1 ? "bg-accent font-medium text-accent-ink" : "raised"}`}>
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="demo" aria-labelledby="see" className="grid items-center gap-10 md:grid-cols-[1fr_auto] md:gap-16" data-reveal>
        <div className="flex flex-col gap-4">
          <h2 id="see" className="text-2xl font-semibold md:text-3xl">
            See it in action
          </h2>
          <p className="text-base text-muted md:text-lg">Try the real app screens here with sample data. Tap how a set felt, watch the rest timer start by itself, then see what changes next time.</p>
          <ul className="flex flex-col gap-2 text-base">
            {["One tap logs a set", "Rest timer starts by itself", "Your next weights the moment you finish", "Progress you can see week by week"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs text-accent-ink">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="w-full md:w-[24rem]">
          <Demo />
        </div>
      </section>

      <section aria-labelledby="what" className="flex flex-col gap-6" data-reveal>
        <h2 id="what" className="text-2xl font-semibold md:text-3xl">
          What it does
        </h2>
        <ul className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="card lift p-6" data-reveal style={{ "--d": `${i * 80}ms` } as React.CSSProperties}>
              <p className="text-lg font-medium">{f.title}</p>
              <p className="mt-2 text-base text-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="flex flex-col gap-6" data-reveal>
        <h2 id="how" className="text-2xl font-semibold md:text-3xl">
          How to use it
        </h2>
        <ol className="grid gap-5 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card lift p-6" data-reveal style={{ "--d": `${i * 80}ms` } as React.CSSProperties}>
              <span className="pressed grid size-10 place-items-center rounded-full text-base font-medium text-accent">{i + 1}</span>
              <p className="mt-4 text-lg font-medium">{s.title}</p>
              <p className="mt-2 text-base text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="install" aria-labelledby="get" className="flex scroll-mt-6 flex-col gap-6 rounded-3xl" data-reveal>
        <h2 id="get" className="text-2xl font-semibold md:text-3xl">
          Get the app on your phone
        </h2>
        <p className="text-base text-muted">
          {onPhone
            ? "Liftly is a web app: there is nothing to download from an app store. Add it to your home screen and it opens like any other app, even without internet."
            : "Open liftly.space on your phone, then add it to the home screen. It opens like any other app, even without internet. There is nothing to download from an app store."}
        </p>
        <div className="flex flex-wrap gap-3" role="group" aria-label="Choose your phone">
          {(["ios", "android"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={choice === p} onClick={() => setChoice(p)} className={`min-h-12 rounded-full px-5 text-base ${choice === p ? "pressed font-medium text-accent" : "raised"}`}>
              {INSTALL[p].name}
            </button>
          ))}
          {!onPhone && (
            <button type="button" aria-pressed={choice === "both"} onClick={() => setChoice("both")} className={`min-h-12 rounded-full px-5 text-base ${choice === "both" ? "pressed font-medium text-accent" : "raised"}`}>
              Both
            </button>
          )}
        </div>
        <div className={`grid gap-5 ${shown.length > 1 ? "md:grid-cols-2" : "md:max-w-xl"}`}>
          {shown.map((p) => (
            <div key={p} className="card pop p-6" data-install={p}>
              <p className="text-lg font-medium">{INSTALL[p].name}</p>
              <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-base text-muted marker:text-accent">
                {INSTALL[p].steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="faq" className="flex flex-col gap-5" data-reveal>
        <h2 id="faq" className="text-2xl font-semibold md:text-3xl">
          Good to know
        </h2>
        <dl className="grid gap-5 md:grid-cols-2">
          <div className="card lift p-6">
            <dt className="text-lg font-medium">Do I need an account?</dt>
            <dd className="mt-2 text-base text-muted">No. You can start straight away and your workouts stay on your phone. Create an account (email and password) only if you want them backed up and available on another phone.</dd>
          </div>
          <div className="card lift p-6">
            <dt className="text-lg font-medium">Is it medical advice?</dt>
            <dd className="mt-2 text-base text-muted">No. Liftly is not medical care and doesn't diagnose or treat injuries. If something hurts it stops suggesting that exercise, and for anything serious it tells you to see a qualified professional.</dd>
          </div>
          <div className="card lift p-6">
            <dt className="text-lg font-medium">What about the AI part?</dt>
            <dd className="mt-2 text-base text-muted">Optionally, an AI model can write a short summary after a workout. It only explains; Liftly's own rules decide every weight. It is off until you turn it on, and you choose that yourself.</dd>
          </div>
          <div className="card lift p-6">
            <dt className="text-lg font-medium">What does it cost?</dt>
            <dd className="mt-2 text-base text-muted">Nothing today. It uses kilograms and is built for gyms in India.</dd>
          </div>
        </dl>
      </section>

      <footer className="flex flex-col items-start gap-3 border-t border-line pt-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <p>Liftly. Not medical advice.</p>
        <button type="button" onClick={useInBrowser} className="min-h-12 font-medium text-accent underline underline-offset-4" data-use-in-browser>
          Use in browser instead
        </button>
      </footer>
    </div>
  );
}
