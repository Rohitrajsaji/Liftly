// M5: email + password accounts, consent, attaching the device's answers to the account, offline sync, deletion.
// A fake Supabase (e2e/support/fakeSupabase.ts) answers the app's real requests.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { FakeSupabase } from "./support/fakeSupabase";

const EMAIL = "rohit@example.com";
const PASSWORD = "correct horse 9";

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function onboard(page: Page, days: 3 | 4, months = 2) {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  for (let i = 0; i < months; i++) await page.getByRole("button", { name: "One month more" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: new RegExp(`^${days} days a week`) }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
}

async function signIn(page: Page, mode: "create" | "signin" = "create", email = EMAIL) {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  if (mode === "signin") await page.getByRole("button", { name: "I have an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: mode === "create" ? "Create account" : "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
}

async function setup(context: BrowserContext, fake = new FakeSupabase()) {
  await fake.install(context);
  return fake;
}

test("create an account: nothing uploads before, then plan and consent attach to the account", async ({ page, context }) => {
  const fake = await setup(context);
  await onboard(page, 4, 2);
  await page.getByRole("button", { name: "Create account to save your plan" }).click();
  await expect(page.getByRole("heading", { name: "Before you create an account" })).toBeVisible();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  // C7: through onboarding and consent, no data call has been made.
  expect(fake.restCalls).toEqual([]);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
  expect(fake.signUps).toEqual([EMAIL]);
  await expect(page.getByText("Your plan is saved to your account.")).toBeVisible();

  await expect.poll(() => fake.profiles.size).toBe(1);
  const userId = fake.users.get(EMAIL) ?? "";
  expect(fake.profiles.get(userId)).toMatchObject({ user_id: userId, months_training: 2, program: "4-day", start_date: today() });
  expect([...fake.consents.values()]).toMatchObject([{ user_id: userId, consent_version: "draft-1" }]);
  await expect(page.locator("[data-sync-pending]")).toHaveCount(0);
});

test("password problems are explained: short, wrong, already registered, rate limited, offline", async ({ page, context }) => {
  const fake = await setup(context);
  fake.passwords.set(EMAIL, PASSWORD);
  fake.users.set(EMAIL, "00000000-0000-4000-8000-000000000099");
  await onboard(page, 3);
  await page.getByRole("button", { name: "Create account to save your plan" }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  const submit = page.getByRole("button", { name: "Create account", exact: true });
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await expect(submit).toBeDisabled();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill("short");
  await expect(submit).toBeDisabled();

  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  fake.rateLimitNext = true;
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("Too many tries");
  fake.offline = true;
  await context.setOffline(true);
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("You're offline");
  fake.offline = false;
  await context.setOffline(false);
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("already an account");

  await page.getByRole("button", { name: "I have an account" }).click();
  await page.getByLabel("Password", { exact: true }).fill("wrong password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("email or password isn't right");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
});

test("a new phone: signing in to the same account brings back the saved plan", async ({ page, context, browser }) => {
  const fake = await setup(context);
  await onboard(page, 4, 5);
  await signIn(page);
  await expect.poll(() => fake.profiles.size).toBe(1);

  const other = await browser.newContext();
  await fake.install(other);
  const phone2 = await other.newPage();
  await phone2.goto("/");
  await expect(phone2.getByRole("heading", { name: "Know what to lift next" })).toBeVisible();
  await signIn(phone2, "signin");
  await expect(phone2.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await expect(phone2.getByText("4-Day Upper / Lower Program")).toBeVisible();
  await expect(phone2.locator("[data-workout]")).toHaveCount(4);
  await other.close();
});

test("O-03: changes made offline wait on the phone, then sync once with no duplicates", async ({ page, context }) => {
  const fake = await setup(context);
  await onboard(page, 3);
  await signIn(page);
  await expect.poll(() => fake.profiles.size).toBe(1);

  fake.offline = true;
  await context.setOffline(true);
  await page.getByRole("button", { name: "Change program" }).click();
  await page.getByRole("radio", { name: /^4 days a week/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-workout]")).toHaveCount(4);
  await expect(page.locator("[data-sync-pending]")).toBeVisible();
  expect([...fake.profiles.values()][0]?.program).toBe("3-day");

  const writesBefore = fake.profileWrites;
  fake.offline = false;
  await context.setOffline(false);
  await expect(page.locator("[data-sync-pending]")).toHaveCount(0);
  expect(fake.profiles.size).toBe(1);
  expect([...fake.profiles.values()][0]?.program).toBe("4-day");
  expect(fake.profileWrites - writesBefore).toBe(1);
  expect(fake.consents.size).toBe(1);
});

test("the sign-in survives a reload and works offline", async ({ page, context }) => {
  const fake = await setup(context);
  await onboard(page, 3);
  await signIn(page);
  fake.offline = true;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
});

test("sign out keeps the plan on the phone and the data on the account", async ({ page, context }) => {
  const fake = await setup(context);
  await onboard(page, 3);
  await signIn(page);
  await expect.poll(() => fake.profiles.size).toBe(1);
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}`)).toBeVisible();
  await expect(page.getByText("Everything is saved to your account.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  expect(fake.profiles.size).toBe(1);
});

test("deleting the account removes the server data and clears the phone", async ({ page, context }) => {
  const fake = await setup(context);
  await onboard(page, 4);
  await signIn(page);
  await expect.poll(() => fake.profiles.size).toBe(1);

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Delete account" }).click();
  // The first tap only asks; nothing is deleted yet.
  await expect(page.getByText("permanently deletes your account")).toBeVisible();
  expect(fake.rpcCalls).toEqual([]);
  await page.getByRole("button", { name: "Keep my account" }).click();
  expect(fake.profiles.size).toBe(1);

  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("button", { name: "Yes, delete my account and data" }).click();
  await expect(page.getByRole("heading", { name: "Know what to lift next" })).toBeVisible();
  expect(fake.rpcCalls).toHaveLength(1);
  expect(fake.profiles.size).toBe(0);
  expect(fake.consents.size).toBe(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Know what to lift next" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("deleting needs a connection and says so", async ({ page, context }) => {
  const fake = await setup(context);
  await onboard(page, 3);
  await signIn(page);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Delete account" }).click();
  fake.offline = true;
  await context.setOffline(true);
  await page.getByRole("button", { name: "Yes, delete my account and data" }).click();
  await expect(page.getByRole("alert")).toContainText("You're offline");
  expect(fake.profiles.size).toBe(1);
});

test("account screens fit the phone: large targets, no sideways scroll", async ({ page, context }) => {
  await setup(context);
  await onboard(page, 3);
  const check = async (label: string, heading: string) => {
    // Measure only once the screen has replaced the previous one.
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    const small = await page.locator("button, input:not([type=checkbox])").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 48).map((e) => e.textContent));
    expect(small, label).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  };
  await check("plan", "Your plan");
  await page.getByRole("button", { name: "Create account to save your plan" }).click();
  await check("consent", "Before you create an account");
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await check("create", "Create your account");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
  await page.getByRole("button", { name: "Account" }).click();
  await check("account", "Account");
});
