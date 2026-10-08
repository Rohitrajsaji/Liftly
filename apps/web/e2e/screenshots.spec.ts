// Not part of the normal run: SHOTS=/some/dir pnpm exec playwright test e2e/screenshots.spec.ts --project=android
// Takes the screenshots for the milestone report.
import { test, type Page } from "@playwright/test";

const dir = process.env["SHOTS"];
test.skip(dir === undefined, "set SHOTS to a folder to take screenshots");

const RANGES: Record<string, [string, string, string]> = { machine: ["10", "100", "10"], cable: ["5", "60", "5"], dumbbell: ["2", "30", "2"] };

test("screenshots", async ({ page }) => {
  const shot = (name: string) => page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /^3 days a week/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue to your first workout" }).click();
  await shot("01-today-needs-gym");
  await page.getByRole("button", { name: "Set your gym's weights" }).click();
  await shot("02-gym-weights");
  await fill(page, "machine");
  await shot("03-ladder-editor");
  await page.getByRole("button", { name: "Save weights" }).click();
  for (const k of ["cable", "dumbbell"]) {
    await page.locator(`[data-equipment=${k}]`).getByRole("button", { name: "Add" }).click();
    await fill(page, k);
    await page.getByRole("button", { name: "Save weights" }).click();
  }
  await page.getByRole("button", { name: "Done" }).click();
  await shot("04-today-first-workout");
  await page.getByRole("button", { name: "Start workout" }).click();
  await shot("05-workout-list");
  await page.locator("[data-exercise-row]").first().click();
  await shot("06-calibration-ramp");
  await page.locator("[data-effort=easy]").click();
  await shot("07-ramp-rest-timer");
  await page.locator("[data-effort=good]").click();
  await shot("08-working-sets");
  await page.locator("[data-report-pain]").click();
  await shot("09-pain-report");
  await page.locator("[data-location=knee]").click();
  await page.locator("[data-severity='3']").click();
  await page.locator("[data-answer=rest-no]").click();
  await page.locator("[data-answer=odd-no]").click();
  await shot("10-pain-filled");
  await page.getByRole("button", { name: "Stop this exercise" }).click();
  await shot("11-pain-stopped");
  await page.getByRole("button", { name: "Back to workout" }).click();
  await page.locator("[data-exercise-row]").nth(1).click();
  await page.locator("[data-effort=good]").click();
  await page.locator("[data-effort=good]").click();
  await page.getByRole("button", { name: "Workout list" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await shot("12-summary");
});

async function fill(page: Page, kind: string) {
  const [from, to, step] = RANGES[kind] ?? ["10", "20", "5"];
  if (await page.getByRole("heading", { name: "Your gym's weights" }).isVisible()) await page.locator(`[data-equipment=${kind}]`).getByRole("button", { name: /Add|Edit/ }).click();
  await page.getByLabel("Start (kg)").fill(from);
  await page.getByLabel("End (kg)").fill(to);
  await page.getByLabel("Step (kg)").fill(step);
  await page.getByRole("button", { name: "Add range" }).click();
}
