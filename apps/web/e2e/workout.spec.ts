// M6: the workout experience, end to end in a real browser: gym weights, calibration, logging, rest timer, pain, offline.
import { expect, test, type Page } from "@playwright/test";
import { FakeSupabase } from "./support/fakeSupabase";

async function onboard(page: Page, days: 3 | 4 = 3) {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: new RegExp(`^${days} days a week`) }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to your first workout" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
}

const RANGES: Record<string, [string, string, string]> = {
  machine: ["10", "100", "10"],
  cable: ["5", "60", "5"],
  dumbbell: ["2", "30", "2"],
  bodyweight: ["5", "40", "5"],
};

async function setupGym(page: Page) {
  await page.getByRole("button", { name: "Set your gym's weights" }).click();
  for (const kind of ["machine", "cable", "dumbbell", "bodyweight"]) {
    const card = page.locator(`[data-equipment=${kind}]`);
    if ((await card.count()) === 0) continue;
    await card.getByRole("button", { name: /^(Add|Edit)$/ }).click();
    const [from, to, step] = RANGES[kind] ?? ["10", "20", "5"];
    await page.getByLabel("Start (kg)").fill(from);
    await page.getByLabel("End (kg)").fill(to);
    await page.getByLabel("Step (kg)").fill(step);
    await page.getByRole("button", { name: "Add range" }).click();
    await page.getByRole("button", { name: "Save weights" }).click();
    await expect(page.getByRole("heading", { name: "Your gym's weights" })).toBeVisible();
  }
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
}

const tap = (page: Page, effort: string) => page.locator(`[data-effort=${effort}]`).click();

async function quickWorkout(page: Page) {
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.locator("[data-exercise-row]").first().click();
  await tap(page, "good");
  await page.getByRole("button", { name: "Workout list" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByRole("heading", { name: "Workout saved" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
}

test("first run: gym weights are needed, then today's workout shows calibration for every exercise", async ({ page }) => {
  await onboard(page);
  await expect(page.getByRole("button", { name: "Start workout" })).toHaveCount(0);
  await setupGym(page);
  await expect(page.locator("[data-workout-name]")).toHaveText("Workout A");
  const rows = page.locator("[data-exercise-row]");
  await expect(rows).toHaveCount(5);
  await expect(page.locator("[data-calibration-note]")).toContainText("Start light");
  await page.reload();
  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();
});

test("calibration: a Good first set ends the ramp, one tap logs a set, the rest timer runs, undo works", async ({ page }) => {
  await onboard(page);
  await setupGym(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.locator("[data-exercise-row]").first().click();
  await expect(page.locator("[data-set-heading]")).toHaveText("Warm-up set 1");
  await expect(page.locator("[data-weight]")).toContainText("10");
  // Easy moves up one step of the user's own list (10 -> 20).
  await tap(page, "easy");
  await expect(page.locator("[data-set-heading]")).toHaveText("Warm-up set 2");
  await expect(page.locator("[data-weight]")).toContainText("20");
  await expect(page.locator("[data-rest]")).toBeVisible();
  await expect(page.locator("[data-rest-hint]")).toContainText("Rest 1–2 min");
  await tap(page, "good");
  await expect(page.getByText("Your working weight: 20 kg.")).toBeVisible();
  await expect(page.locator("[data-set-heading]")).toHaveText("Set 2 of 3");
  await expect(page.locator("[data-logged-set]")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo last set" }).click();
  await expect(page.locator("[data-logged-set]")).toHaveCount(1);
  await expect(page.locator("[data-set-heading]")).toHaveText("Warm-up set 2");
});

test("the workout in progress survives a reload (O-02)", async ({ page }) => {
  await onboard(page);
  await setupGym(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.locator("[data-exercise-row]").first().click();
  await tap(page, "good");
  await expect(page.locator("[data-logged-set]")).toHaveCount(1);
  // The write to the phone is queued right after the tap; give it a moment before pulling the plug.
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole("button", { name: "Continue workout" }).click();
  await expect(page.locator("[data-exercise-row][data-status=in_progress]")).toHaveCount(1);
});

test("pain: stops the exercise with the fixed text, and the next workout uses the approved swap", async ({ page }) => {
  await onboard(page);
  await setupGym(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.locator("[data-exercise-row]").first().click();
  await tap(page, "good");
  await page.locator("[data-report-pain]").click();
  await expect(page.getByRole("button", { name: "Stop this exercise" })).toBeDisabled();
  await page.locator("[data-location=knee]").click();
  await page.locator("[data-severity='3']").click();
  await page.locator("[data-answer=rest-no]").click();
  await page.locator("[data-answer=odd-no]").click();
  await page.getByRole("button", { name: "Stop this exercise" }).click();
  await expect(page.locator("[data-pain-stop]")).toContainText("We've paused this exercise for today");
  await expect(page.locator("[data-professional-help]")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to workout" }).click();
  await expect(page.locator("[data-exercise-row][data-status=stopped_pain]")).toHaveCount(1);
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  // The slot's swap shows up the next time that workout comes round (A -> B -> C -> A).
  for (let i = 0; i < 2; i++) await quickWorkout(page);
  await expect(page.locator("[data-workout-name]")).toHaveText("Workout A");
  await expect(page.locator("[data-exercise-row]").first()).toContainText("instead of");
});

test("serious pain shows the professional-help message", async ({ page }) => {
  await onboard(page);
  await setupGym(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.locator("[data-exercise-row]").first().click();
  await page.locator("[data-report-pain]").click();
  await page.locator("[data-location=shoulder]").click();
  await page.locator("[data-severity='8']").click();
  await page.locator("[data-answer=rest-yes]").click();
  await page.locator("[data-answer=odd-yes]").click();
  await page.getByRole("button", { name: "Stop this exercise" }).click();
  await expect(page.locator("[data-professional-help]")).toContainText("qualified professional");
});

test("a finished workout shows the engine's next target; the next time round shows last time's sets", async ({ page }) => {
  await onboard(page);
  await setupGym(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.locator("[data-exercise-row]").first().click();
  await tap(page, "good");
  await tap(page, "good");
  await tap(page, "good");
  await expect(page.getByRole("button", { name: "Next exercise" })).toBeVisible();
  await page.getByRole("button", { name: "Workout list" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.locator("[data-result] [data-next]").first()).toContainText("Next time");
  await page.getByRole("button", { name: "Done" }).click();
  for (let i = 0; i < 2; i++) await quickWorkout(page);
  const first = page.locator("[data-exercise-row]").first();
  await expect(first).toContainText("Last time: 10 kg ×");
  await expect(page.locator("[data-calibration-note]")).toHaveCount(0);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.locator("[data-exercise-row]").first().click();
  await expect(page.locator("[data-previous]")).toContainText("Last time");
  await expect(page.locator("[data-set-heading]")).toHaveText("Set 1 of 3");
});

test("tap targets are large and nothing scrolls sideways on the workout screens", async ({ page }) => {
  await onboard(page);
  await setupGym(page);
  const check = async () => {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button, a, input, summary")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ t: (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30), h: el.getBoundingClientRect().height }))
        .filter((x) => x.h < 47.5),
    );
    expect(small).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  };
  await check();
  await page.getByRole("button", { name: "Start workout" }).click();
  await check();
  await page.locator("[data-exercise-row]").first().click();
  await check();
  await tap(page, "good");
  await check();
  await page.locator("[data-report-pain]").click();
  await check();
});

test.describe("with an account", () => {
  test("offline workouts wait on the phone, then upload once; a new phone gets the workout and gym weights back", async ({ page, context, browser }) => {
    const fake = new FakeSupabase();
    await fake.install(context);
    await onboard(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "I agree and continue" }).click();
    await page.getByLabel("Email").fill("rohit@example.com");
    await page.getByLabel("Password", { exact: true }).fill("correct horse 9");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

    await setupGym(page);
    await expect.poll(() => fake.ladders.size).toBeGreaterThan(5);
    fake.offline = true;
    await context.setOffline(true);
    await quickWorkout(page);
    expect(fake.events.size).toBe(0);
    await expect(page.locator("[data-sync-pending]")).toBeVisible();
    fake.offline = false;
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => fake.events.size).toBe(1);
    await page.waitForTimeout(500);
    expect(fake.events.size).toBe(1);
    const ev = [...fake.events.values()][0];
    expect(ev?.kind).toBe("session");

    // A second phone.
    const phone2 = await browser.newContext({ viewport: { width: 412, height: 900 } });
    await fake.install(phone2);
    const p2 = await phone2.newPage();
    await p2.goto("/");
    await p2.getByRole("button", { name: "Sign in", exact: true }).click();
    await p2.getByRole("button", { name: "I agree and continue" }).click();
    await p2.getByRole("button", { name: "I have an account" }).click();
    await p2.getByLabel("Email").fill("rohit@example.com");
    await p2.getByLabel("Password", { exact: true }).fill("correct horse 9");
    await p2.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(p2.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(p2.locator("[data-workout-name]")).toHaveText("Workout B");
    await expect(p2.getByRole("button", { name: "Start workout" })).toBeVisible();
    await phone2.close();
  });

  test("signed out workouts join the account at sign-in", async ({ page, context }) => {
    const fake = new FakeSupabase();
    await fake.install(context);
    await onboard(page);
    await setupGym(page);
    await quickWorkout(page);
    expect(fake.restCalls).toEqual([]);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "I agree and continue" }).click();
    await page.getByLabel("Email").fill("rohit@example.com");
    await page.getByLabel("Password", { exact: true }).fill("correct horse 9");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
    await expect.poll(() => fake.events.size).toBe(1);
    await expect.poll(() => fake.ladders.size).toBeGreaterThan(5);
  });
});

test.describe("Claude summary (M8)", () => {
  async function signedIn(page: Page, context: import("@playwright/test").BrowserContext) {
    const fake = new FakeSupabase();
    await fake.install(context);
    await onboard(page);
    await setupGym(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "I agree and continue" }).click();
    await page.getByLabel("Email").fill("rohit@example.com");
    await page.getByLabel("Password", { exact: true }).fill("correct horse 9");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
    return fake;
  }
  const turnOn = async (page: Page) => {
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("button", { name: "Turn on…" }).click();
    await expect(page.getByText("No name, email or phone number is sent.")).toBeVisible();
    await page.getByRole("button", { name: "I agree, turn on" }).click();
    await expect(page.getByText("On. After each workout an AI model writes")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
  };
  const finishOne = async (page: Page) => {
    await page.getByRole("button", { name: "Start workout" }).click();
    await page.locator("[data-exercise-row]").first().click();
    await tap(page, "good");
    await page.getByRole("button", { name: "Workout list" }).click();
    await page.getByRole("button", { name: "Finish workout" }).click();
    await expect(page.getByRole("heading", { name: "Workout saved" })).toBeVisible();
  };

  test("off by default: the fixed summary shows and nothing is sent to Claude", async ({ page, context }) => {
    const fake = await signedIn(page, context);
    await finishOne(page);
    await expect(page.locator("[data-debrief=fallback]")).toContainText("Workout saved.");
    await page.waitForTimeout(400);
    expect(fake.debriefCalls).toBe(0);
  });

  test("turned on: Claude's checked text replaces the fixed one, and History keeps it", async ({ page, context }) => {
    const fake = await signedIn(page, context);
    await turnOn(page);
    expect([...fake.consents.values()].map((c) => c.consent_version)).toContain("ai-debrief-draft-2");
    await finishOne(page);
    await expect(page.locator("[data-debrief=claude]")).toContainText("You finished session 1 of your plan.");
    expect(fake.debriefCalls).toBe(1);
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.locator("[data-history-item] summary").first().click();
    await expect(page.locator("[data-history-debrief]")).toContainText("You finished session 1");
  });

  test("an unusable answer keeps the fixed text, retries once later, then stops", async ({ page, context }) => {
    const fake = await signedIn(page, context);
    await turnOn(page);
    fake.debriefMode = "invalid";
    await finishOne(page);
    await expect(page.locator("[data-debrief=fallback]")).toContainText("Workout saved.");
    expect(fake.debriefCalls).toBe(1);
    await page.reload();
    await expect.poll(() => fake.debriefCalls).toBe(2);
    await page.reload();
    await page.waitForTimeout(600);
    expect(fake.debriefCalls).toBe(2);
  });

  test("Claude down: the workout and its targets are still saved with the fixed text; the retry can succeed", async ({ page, context }) => {
    const fake = await signedIn(page, context);
    await turnOn(page);
    fake.debriefMode = "down";
    await finishOne(page);
    await expect(page.locator("[data-debrief=fallback]")).toBeVisible();
    await expect.poll(() => fake.events.size).toBe(1);
    fake.debriefMode = "ok";
    await page.reload();
    await expect.poll(() => fake.debriefCalls).toBe(2);
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.locator("[data-history-item] summary").first().click();
    await expect(page.locator("[data-history-debrief]")).toContainText("You finished session 1");
  });
});

test.describe("progress and history", () => {
  test("empty before the first workout; then history, records, chart and weekly count appear (works offline)", async ({ page, context }) => {
    await onboard(page);
    await setupGym(page);
    await page.getByRole("button", { name: "Progress", exact: true }).click();
    await expect(page.locator("[data-empty]")).toBeVisible();
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.locator("[data-empty]")).toBeVisible();
    await page.getByRole("button", { name: "Today", exact: true }).click();

    // One full exercise: calibration (Good first) then two more sets at 8 reps, the bottom of the range.
    await page.getByRole("button", { name: "Start workout" }).click();
    await page.locator("[data-exercise-row]").first().click();
    await tap(page, "good");
    await tap(page, "good");
    await tap(page, "good");
    await page.getByRole("button", { name: "Workout list" }).click();
    await page.getByRole("button", { name: "Finish workout" }).click();
    await page.getByRole("button", { name: "Done" }).click();

    await context.setOffline(true);
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.locator("[data-history-item]")).toHaveCount(1);
    await page.locator("[data-history-item] summary").click();
    await expect(page.locator("[data-history-item]")).toContainText("Leg Press");
    await expect(page.locator("[data-history-item]")).toContainText("10 kg × 8");

    await page.getByRole("button", { name: "Progress", exact: true }).click();
    await expect(page.locator("[data-record]")).toHaveCount(1);
    await expect(page.locator("[data-record]")).toContainText("10 kg × 8");
    await expect(page.locator("[data-chart]")).toBeVisible();
    await expect(page.getByText("One workout so far")).toBeVisible();
    await expect(page.locator("[data-weeks] li")).toHaveCount(8);
    await context.setOffline(false);
  });
});
