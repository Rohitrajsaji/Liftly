import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPlatform, startsAsApp } from "../src/mode";

describe("what a visit shows", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("the tests' build goes straight to the app, and ?site=1 shows the website", () => {
    expect(startsAsApp("e2e", "")).toBe(true);
    expect(startsAsApp("e2e", "?site=1")).toBe(false);
  });
  it("a normal browser visit shows the website (no standalone display, no earlier choice)", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal("navigator", { standalone: false });
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) });
    expect(startsAsApp("production", "")).toBe(false);
    expect(startsAsApp("production", "?app=1")).toBe(true);
    store["liftly.useInBrowser"] = "1";
    expect(startsAsApp("production", "")).toBe(true);
  });
  it("the installed app (standalone) loads the app", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("navigator", { standalone: false });
    vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: q.includes("standalone") }) });
    expect(startsAsApp("production", "")).toBe(true);
    vi.stubGlobal("navigator", { standalone: true });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    expect(startsAsApp("production", "")).toBe(true);
  });
});

describe("detectPlatform", () => {
  it("tells iPhone, iPad (which reports as a Mac), Android and desktop apart", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("other");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 7)")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("other");
  });
});
