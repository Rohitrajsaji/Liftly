# Supabase setup for Liftly (M5)

What to create, what to change, and which values to send. About 15 minutes. All of it is on the Free plan.

## What you do

1. **Create the project.** At supabase.com, sign in, create an organization (Free plan), then **New project**.
   - Name: `liftly`
   - Region: **South Asia (Mumbai)**
   - Database password: let Supabase generate one and keep it in your password manager. You do not send it to anyone.
2. **Create the tables.** Open **SQL Editor → New query**, paste the whole of
   [`supabase/migrations/0001_accounts.sql`](supabase/migrations/0001_accounts.sql), and press **Run**. It should say "Success. No rows returned".
   It creates two tables (`profiles`, `consents`), their privacy rules, and the delete-my-account function. It does not touch any other setting.
   Then do the same with [`supabase/migrations/0002_workouts.sql`](supabase/migrations/0002_workouts.sql) (M6: workouts and gym weights; run it after 0001).
3. **Turn off email confirmation.** Liftly signs in with an email and a password, so no email template is needed. Open **Authentication → Sign In / Providers → Email**: keep "Enable Email provider" and "Enable email signups" on, and turn **"Confirm email" OFF**. Save.
4. **AI summaries (M8, optional until you want them).** Without this the app shows fixed summary text after each workout.
   - Run [`supabase/migrations/0003_debrief_log.sql`](supabase/migrations/0003_debrief_log.sql) in the SQL Editor (it only counts requests, to cap cost: 20 per account per day).
   - Create a free OpenRouter account and API key at openrouter.ai/keys (the defaults are fast free models, tried in order: `google/gemma-4-31b-it:free`, `nvidia/nemotron-3.5-lightning:free`, `google/gemma-4-26b-a4b-it:free`, then `openrouter/free`; to change the list add a secret `DEBRIEF_MODELS`, models separated by commas). **Do not paste it in the thread or the app.** In Supabase open **Edge Functions → Secrets** and add `OPENROUTER_API_KEY`.
   - Deploy the function: in **Edge Functions → Deploy a new function → Via Editor**, name it `debrief`, paste [`supabase/functions/debrief/index.ts`](supabase/functions/debrief/index.ts), and deploy. "Verify JWT" can stay on (checked live on 2026-10-10); the function also checks the signed-in user itself and refuses anyone else. To update it later, open the function, paste the new file over the old one and deploy again, or run `supabase functions deploy debrief` from a linked checkout.
   - In the app: Account → AI workout summaries → Turn on. Each person chooses this themselves.
5. **Send me two values** (both are safe to paste in the thread; they are designed to be public in the app):
   - **Project URL**, like `https://abcdxyz.supabase.co` (Project Settings → Data API or General)
   - **Publishable key**, starting `sb_publishable_` (Project Settings → API Keys). The older "anon" key also works.

## What you must not send

The **service_role / secret key**, the **database password**, and any **access token**. Nothing in Liftly needs them. Account deletion is a database function that runs as the signed-in user, so no secret key lives in the app.

## Limits to know about (Free plan)

- **No emails are sent** at sign-up or sign-in while "Confirm email" is off, so the Free plan's email limits do not matter. The cost: an account can be created with someone else's address, and there is no password reset yet (a reset email would need custom SMTP and a template). Before outside testers, turn confirmation on with custom SMTP (a domain you own plus an email service such as Resend) and add a reset flow.
- **Pausing.** A Free project pauses after 7 days with no activity. Fine while building; before real testers, either use it daily or move to Pro (about $25 a month).
- **Google sign-in** is not part of this first flow. It needs a Google Cloud OAuth client and adds setup; email and password is enough to start.

## What I need from you besides Supabase

- **Consent text.** `apps/web/src/consent.ts` has a DRAFT (`draft-1`). Please read it and tell me what to change. It is a draft, not legal advice, and SAFETY.md §6 still lists the retention period and a legal check against India's DPDP Act as open.

## How I will check it

With the two values I run a smoke test against your project: signed-out requests are refused, and the tables exist with privacy rules on. please create an account once on your phone when I tell you it is ready.
