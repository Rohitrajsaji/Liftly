import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { Landing } from "./screens/Landing";
import { startsAsApp } from "./mode";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "./styles.css";

// Precaches the app shell so Liftly opens with no network.
registerSW({ immediate: true });

// Ask the browser not to evict local data under storage pressure (logged workouts live here first).
void navigator.storage?.persist?.().catch(() => undefined);

// Each screen sets its own scroll position; the browser restoring an old one on back makes Today open scrolled down.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const root = document.getElementById("root");
if (root === null) throw new Error("No #root element");

/** The website in a normal browser; the app itself once it is on the home screen. */
function Site() {
  const [app, setApp] = useState(() => startsAsApp(import.meta.env.MODE, window.location.search));
  return app ? <App /> : <Landing onUseInBrowser={() => setApp(true)} />;
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Site />
    </ErrorBoundary>
  </StrictMode>,
);
