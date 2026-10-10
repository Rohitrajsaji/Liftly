// The website shown in a normal browser: what Liftly is, how to use it, how to add it to a phone. The browser tests
// build in a mode that opens the app directly; ?site=1 shows the website instead.
import { expect, test } from "@playwright/test";

test("the website explains Liftly and shows install steps for both phones on a desktop-style visit", async ({ page }) => {
  await page.goto("/?site=1");
  await expect(page.getByRole("heading", { name: "Know what to lift next." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What it does" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How to use it" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Get the app on your phone" })).toBeVisible();
  // The app itself is not loaded.
  await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
});

test("install steps match the phone, and the tabs switch them", async ({ page }) => {
  await page.goto("/?site=1");
  const ios = page.locator("[data-install=ios]");
  const android = page.locator("[data-install=android]");
  if ((await ios.count()) > 0 && (await android.count()) > 0) {
    await page.getByRole("button", { name: "Android", exact: true }).click();
    await expect(android).toBeVisible();
    await expect(ios).toHaveCount(0);
  }
  await expect(android.or(ios).first()).toContainText("Add to Home");
});

test("'Use in browser instead' opens the app and remembers the choice", async ({ page }) => {
  await page.goto("/?site=1");
  await page.locator("[data-use-in-browser]").click();
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
});

test("the website fits a phone with no sideways scroll and big tap targets", async ({ page }) => {
  await page.goto("/?site=1");
  await expect(page.getByRole("heading", { name: "How to use it" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const small = await page.locator("[data-landing] button, [data-landing] a").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 48).map((e) => e.textContent));
  expect(small).toEqual([]);
});

test.describe("desktop width", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("two columns, no sideways scroll", async ({ page }) => {
    await page.goto("/?site=1");
    await expect(page.getByRole("heading", { name: "What it does" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: "test-results/landing-desktop.png", fullPage: true });
  });
});
