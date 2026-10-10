// Going back: a Back arrow in the header on every screen that has somewhere to go back to, and the phone's own back
// gesture (browser history) steps back inside the app instead of leaving it. Motion plays unless the person asks for less.
import { expect, test, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /^3 days a week/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue to your first workout" }).click();
  await expect(page.locator("nav [aria-current=page]", { hasText: "Today" })).toBeVisible();
}
const back = (page: Page) => page.getByRole("button", { name: "Previous screen" });

test("the header arrow goes back one step on onboarding, the plan and the gym screen", async ({ page }) => {
  await page.goto("/");
  await expect(back(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: /How long/ })).toBeVisible();
  await back(page).click();
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
  await expect(back(page)).toHaveCount(0);

  await start(page);
  await expect(back(page)).toHaveCount(0);
  await page.getByRole("button", { name: "See full plan" }).click();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await back(page).click();
  await expect(page.locator("nav [aria-current=page]", { hasText: "Today" })).toBeVisible();
  await page.getByRole("button", { name: "Gym weights" }).click();
  await expect(page.getByRole("heading", { name: "Your gym's weights" })).toBeVisible();
  await back(page).click();
  await expect(page.locator("nav [aria-current=page]", { hasText: "Today" })).toBeVisible();
});

test("the phone's back gesture steps back inside the app and never skips a screen", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Gym weights" }).click();
  await expect(page.getByRole("heading", { name: "Your gym's weights" })).toBeVisible();
  await page.goBack();
  await expect(page.locator("nav [aria-current=page]", { hasText: "Today" })).toBeVisible();
  // Open and close again: still one step per press.
  await page.getByRole("button", { name: "See full plan" }).click();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await page.goBack();
  await expect(page.locator("nav [aria-current=page]", { hasText: "Today" })).toBeVisible();
  expect(page.url()).toMatch(/localhost:4173/);
});

test("sign-in screens have the arrow too, and it returns to Today", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Before you create an account" })).toBeVisible();
  await back(page).click();
  await expect(page.locator("nav [aria-current=page]", { hasText: "Today" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.goBack();
  await expect(page.locator("nav [aria-current=page]", { hasText: "Today" })).toBeVisible();
});

test.describe("motion", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });
  test("screens slide in the way you are going, tabs cross-fade, and lists arrive one after another", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "See full plan" }).click();
    const name = await page.locator("section.screen-fwd").first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("screen-fwd");
    // Slow and soft (Rohit, 2026-10-10): screens take about half a second.
    const duration = await page.locator("section.screen-fwd").first().evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(duration).toBeGreaterThanOrEqual(0.4);
    const delays = await page.locator("ol.stagger > *").evaluateAll((els) => els.slice(0, 3).map((e) => getComputedStyle(e).animationDelay));
    expect(new Set(delays).size).toBeGreaterThan(1);
    await back(page).click();
    await expect(page.locator("section.screen-back")).toHaveCount(1);
    await page.getByRole("button", { name: "Progress", exact: true }).click();
    await expect(page.locator("section.screen-fade")).toHaveCount(1);
  });
});
