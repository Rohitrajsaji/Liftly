// Decides what a visit to the site shows. Opened in a normal browser, Liftly is a website that explains the app and how
// to put it on a phone. Opened from the home screen (standalone display mode), it is the app itself.

const KEY = "liftly.useInBrowser";

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches;
}

/** True when the visitor chose "use in browser" before (kept on this device only). */
export function chosenBrowserUse(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function chooseBrowserUse(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Storage blocked: the choice lasts only until the page is reloaded.
  }
}

/**
 * Which screen the page starts with. The browser tests build with MODE "e2e" and go straight to the app, except when
 * the address has ?site=1, which lets them look at the website.
 */
export function startsAsApp(mode: string, search: string): boolean {
  if (mode === "e2e") return !new URLSearchParams(search).has("site");
  if (new URLSearchParams(search).get("app") === "1") return true;
  return isStandalone() || chosenBrowserUse();
}

export type Platform = "ios" | "android" | "other";

export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}
