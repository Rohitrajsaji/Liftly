import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./styles.css";

// Precaches the app shell so Liftly opens with no network.
registerSW({ immediate: true });

// Ask the browser not to evict local data under storage pressure (logged workouts live here first).
void navigator.storage?.persist?.().catch(() => undefined);

const root = document.getElementById("root");
if (root === null) throw new Error("No #root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
