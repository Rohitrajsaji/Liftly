import { exercise, PROGRAMS, type ProgramId } from "@liftly/catalog";
import { expect, test, type Page } from "@playwright/test";

async function onboard(page: Page, months: number, program: ProgramId) {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "How long have you been lifting?" })).toBeFocused();
  for (let i = 0; i < months; i++) await page.getByRole("button", { name: "One month more" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: new RegExp(`^${PROGRAMS[program].sessionsPerWeek} days a week`) }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
}

/** What the preview shows, workout by workout: [name, "sets × reps"] per exercise. */
async function shownPlan(page: Page) {
  return page.locator("[data-workout]").evaluateAll((ws) =>
    ws.map((w) => ({
      key: w.getAttribute("data-workout"),
      rows: [...w.querySelectorAll("[data-exercise]")].map((r) => [r.querySelector("[data-name]")?.textContent, r.querySelector("[data-target]")?.textContent?.replace(/\s+/g, " ").trim()]),
    })),
  );
}

function expectedPlan(id: ProgramId) {
  const p = PROGRAMS[id];
  return p.sequence.map((key) => ({
    key,
    rows: (p.slots.find((s) => s.key === key)?.exercises ?? []).map((r) => {
      const e = exercise(r.exerciseId);
      return [e.name, `${r.sets} × ${e.type === "compound" ? "8–12" : "10–15"}`];
    }),
  }));
}

for (const id of ["3-day", "4-day"] as const) {
  test(`AC-1 ${id}: preview shows the frozen workouts in order, with exact exercises and sets`, async ({ page }) => {
    await onboard(page, 2, id);
    expect(await shownPlan(page)).toEqual(expectedPlan(id));
  });
}

test("AC-2: the plan is visible with no account, and answers survive a reload", async ({ page }) => {
  await onboard(page, 0, "4-day");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await expect(page.getByText("4-Day Upper / Lower Program")).toBeVisible();
});

test("changing program keeps the other answers and updates the preview", async ({ page }) => {
  await onboard(page, 1, "3-day");
  await page.getByRole("button", { name: "Change program" }).click();
  await page.getByRole("radio", { name: /^4 days a week/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  expect(await shownPlan(page)).toEqual(expectedPlan("4-day"));
});

test("more than 12 months shows a note but does not block", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "12", exact: true }).click();
  await expect(page.getByText("built for about your first 12 months")).toHaveCount(0);
  await page.getByRole("button", { name: "One month more" }).click();
  await expect(page.getByText("built for about your first 12 months")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "How many days a week can you train?" })).toBeVisible();
});

test("program step cannot continue without a choice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
});

test("tap targets are at least 48 px tall on every onboarding screen", async ({ page }) => {
  const check = async () => {
    const small = await page.locator("button").evaluateAll((bs) => bs.filter((b) => b.getBoundingClientRect().height < 48).map((b) => b.textContent));
    expect(small).toEqual([]);
  };
  await page.goto("/");
  await check();
  await page.getByRole("button", { name: "Get started" }).click();
  await check();
  await page.getByRole("button", { name: "Continue" }).click();
  await check();
  await page.getByRole("radio", { name: /^3 days a week/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await check();
  await check();
});

test("no horizontal scroll at phone width", async ({ page }) => {
  await onboard(page, 3, "4-day");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the goal is shown as information, with no confirmation step", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Your goal: build muscle.")).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /^3 days a week/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  // The next screen after the program is the plan itself.
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await expect(page.getByText("Goal: build muscle.")).toBeVisible();
});

test("backgrounds stay light with dark text, even when the phone is in dark mode", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4173/");
  const [bg, ink] = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color]);
  const lum = (c: string) => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3;
  expect(lum(bg)).toBeGreaterThan(220);
  expect(lum(ink)).toBeLessThan(60);
  await ctx.close();
});
