// M4 exit check: the app opens and the plan preview works with the network off (airplane mode).
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Wait until the service worker controls the page, so the app shell is precached.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((r) => navigator.serviceWorker.addEventListener("controllerchange", () => r(), { once: true }));
    }
  });
});

test("first open offline after one online visit: onboarding and preview work", async ({ page, context }) => {
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /^3 days a week/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-workout]")).toHaveCount(3);
  await expect(page.getByText("Leg Press").first()).toBeVisible();
});

test("saved plan reopens offline, including on a deep link", async ({ page, context }) => {
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /^4 days a week/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await context.setOffline(true);
  await page.goto("/some/deep/link");
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await expect(page.locator("[data-workout]")).toHaveCount(4);
  await context.setOffline(false);
  await expect(page.getByText("Offline", { exact: true })).toHaveCount(0);
});

test("the web app manifest makes Liftly installable", async ({ page, request }) => {
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).not.toBeNull();
  const manifest = await (await request.get(href ?? "")).json();
  expect(manifest).toMatchObject({ name: "Liftly", display: "standalone", start_url: "/" });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});
