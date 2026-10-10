// Plan tailoring (AI_COACH 4a): the plan follows the user's answers with no AI; an AI choice is optional and checked.
import { expect, test, type Page } from "@playwright/test";
import { FakeSupabase } from "./support/fakeSupabase";

async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "One month more" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /^3 days a week/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue to your first workout" }).click();
  await page.getByRole("button", { name: "See full plan" }).click();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
}

const names = (page: Page) => page.locator("[data-name]").allTextContents();

async function answer(page: Page, preference: string) {
  await page.getByRole("button", { name: "Make it fit my gym" }).click();
  await expect(page.getByRole("heading", { name: "Make the plan fit your gym" })).toBeVisible();
  await page.getByRole("radio", { name: new RegExp(preference) }).click();
  await page.getByRole("button", { name: "Build my plan" }).click();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
}

test("a plan built from the answers, with no account and no AI, survives a reload and can be undone", async ({ page }) => {
  await onboard(page);
  const standard = await names(page);
  await expect(page.getByText("Made for your gym")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Let an AI choose…" })).toHaveCount(0);

  await answer(page, "Dumbbells and bodyweight");
  await expect(page.locator("[data-tailored-card]")).toBeVisible();
  await expect(page.locator("[data-plan-source]")).toHaveText("Built from your answers");
  const tailored = await names(page);
  expect(tailored).not.toEqual(standard);
  expect(await page.locator("[data-changed]").count()).toBeGreaterThan(0);

  await page.reload();
  await page.getByRole("button", { name: "See full plan" }).click();
  expect(await names(page)).toEqual(tailored);

  await page.getByRole("button", { name: "Back to the standard plan" }).click();
  await expect(page.locator("[data-tailored-card]")).toHaveCount(0);
  expect(await names(page)).toEqual(standard);
});

test("avoiding an exercise removes it from the plan", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Make it fit my gym" }).click();
  const first = page.getByRole("checkbox").nth(3); // after the three equipment boxes: the first avoidable exercise
  const label = ((await first.innerText()).split("\n")[0] ?? "").trim();
  await first.click();
  await page.getByRole("button", { name: "Build my plan" }).click();
  expect(await names(page)).not.toContain(label);
  await expect(page.getByText(`Skip ${label}`)).toBeVisible();
});

test("the AI picks among approved options after the user allows it; its choice is checked", async ({ page, context }) => {
  const fake = new FakeSupabase();
  await fake.install(context);
  await onboard(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await page.getByLabel("Email").fill("rohit@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct horse 9");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Allow AI tailoring…" }).click();
  await expect(page.getByText("No name, email or phone number is sent")).toBeVisible();
  await page.getByRole("button", { name: "I agree, allow AI tailoring" }).click();
  await expect(page.getByRole("button", { name: "Stop AI tailoring" })).toBeVisible();
  await expect.poll(() => [...fake.consents.values()].some((c) => c.consent_version === "ai-tailor-draft-1")).toBe(true);
  await page.getByRole("button", { name: "Back" }).click();

  await answer(page, "Machines and cables");
  await expect(page.locator("[data-plan-source]")).toHaveText("Chosen by AI, checked by Liftly");
  expect(fake.tailorCalls).toBe(1);
  await expect(page.locator("[data-plan-explanation]")).toContainText("leaned toward");
  await expect.poll(() => (fake.profiles.values().next().value as { tailoring?: { source?: string } } | undefined)?.tailoring?.source).toBe("ai");
});

test("an unusable AI choice is dropped and the answers-based plan stays", async ({ page, context }) => {
  const fake = new FakeSupabase();
  fake.tailorMode = "invalid";
  await fake.install(context);
  await onboard(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await page.getByLabel("Email").fill("rohit@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct horse 9");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Allow AI tailoring…" }).click();
  await page.getByRole("button", { name: "I agree, allow AI tailoring" }).click();
  await expect(page.getByRole("button", { name: "Stop AI tailoring" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await answer(page, "Machines and cables");
  await expect(page.locator("[data-ai-note]")).toContainText("didn't pass Liftly's checks");
  await expect(page.locator("[data-plan-source]")).toHaveText("Built from your answers");
});
