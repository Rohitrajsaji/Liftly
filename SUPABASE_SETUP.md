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
3. **Make the emails send a code, not a link.** Open **Authentication → Emails → Templates**. For both **Confirm sign up** and **Magic link**, replace the body with:

   ```html
   <h2>Your Liftly code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>It expires in 10 minutes. If you did not ask for it, ignore this email.</p>
   ```
   Then **Authentication → Sign In / Providers → Email**: keep "Enable Email provider" and "Enable email signups" on. Set "Email OTP expiration" to `600` seconds and "Email OTP length" to `6`.
4. **Send me two values** (both are safe to paste in the thread; they are designed to be public in the app):
   - **Project URL**, like `https://abcdxyz.supabase.co` (Project Settings → Data API or General)
   - **Publishable key**, starting `sb_publishable_` (Project Settings → API Keys). The older "anon" key also works.

## What you must not send

The **service_role / secret key**, the **database password**, and any **access token**. Nothing in Liftly needs them. Account deletion is a database function that runs as the signed-in user, so no secret key lives in the app.

## Limits to know about (Free plan)

- **Email sending.** Supabase's built-in email service only delivers to people who are members of your Supabase organization, at a few emails per hour. That is enough for you to test. Before outside testers sign in, you need custom SMTP: a domain you own plus an email service (for example Resend, free for 3,000 emails a month). I will ask for that when you are ready for testers.
- **Pausing.** A Free project pauses after 7 days with no activity. Fine while building; before real testers, either use it daily or move to Pro (about $25 a month).
- **Google sign-in** is not part of this first flow. It needs a Google Cloud OAuth client and adds setup; email code alone is enough to start.

## What I need from you besides Supabase

- **Consent text.** `apps/web/src/consent.ts` has a DRAFT (`draft-1`). Please read it and tell me what to change. It is a draft, not legal advice, and SAFETY.md §6 still lists the retention period and a legal check against India's DPDP Act as open.

## How I will check it

With the two values I run a smoke test against your project: signed-out requests are refused, and the tables exist with privacy rules on. I cannot read your inbox, so the one thing I cannot test myself is receiving a real code; please do that once on your phone when I tell you it is ready.
