# Deploying Liftly

Liftly is a static web app (installable PWA) plus a Supabase project. Nothing runs on a server of its own.

## 1. Supabase (once)

Follow `SUPABASE_SETUP.md`: run the three migrations, turn "Confirm email" off for now, and (optional) set up the AI summary function.

## 2. Vercel

1. Import the GitHub repo in Vercel. **Leave the Root Directory as the repository root.** `vercel.json` already sets the install command, build command (`pnpm --filter @liftly/web build`), output directory (`apps/web/dist`), single-page rewrites, security headers and caching.
2. Add two **Environment Variables** (Production and Preview), then deploy:
   - `VITE_SUPABASE_URL`: your project URL, like `https://abcd.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: the publishable key (`sb_publishable_...`). Both are public by design. Never add a service_role key or any secret to Vercel for this app.
3. The values are baked in at build time. After changing them, redeploy.

## 3. Domain (liftly.space)

In Vercel: Project → Settings → Domains → add `liftly.space` (and `www.liftly.space`), then set the DNS records Vercel shows at your domain registrar. HTTPS is automatic. Phones can then open the site and Add to Home Screen.

The Content-Security-Policy in `vercel.json` only allows the app's own files and `https://*.supabase.co`. If you ever add another service (analytics, a custom Supabase domain), add its address to `connect-src`.

## What visitors see

Opened in a normal browser (desktop or phone), `liftly.space` is a website that explains Liftly and how to add it to a phone. Only the installed home-screen app loads the app itself. The page has a small "Use in browser instead" link so you can test on a computer (it remembers the choice on that device; `?app=1` does the same once). Delete the `data-use-in-browser` button in `apps/web/src/screens/Landing.tsx` if you don't want that link.

## 4. After the first deploy: smoke test

On a phone: create an account, finish onboarding, set gym weights, log a workout, finish it, reload the page (everything should still be there), turn on airplane mode and log another workout, then go back online (it should sync). Then try `pnpm --filter @liftly/web smoke` from a machine that can reach Supabase.

## What still needs a human decision before opening to the public

- **Email confirmation and password reset.** Both send email. Supabase's built-in email service only delivers to members of your Supabase organisation and is heavily rate limited, so for public users you need custom SMTP (for example Resend with a domain you own; liftly.space works). Until then, "Confirm email" stays off and there is no password reset.
- **Consent and privacy text** (`apps/web/src/consent.ts`, `debrief.ts`) are drafts. Have them reviewed against India's DPDP Act before real users sign up (SAFETY.md section 6).
- **Pain and safety wording** (`packages/workout/src/text.ts`) is a draft that SAFETY.md says a qualified professional must approve.
- **AI summaries** run on a free OpenRouter model: rate limited, and the provider may keep prompts. Fine for testing; for public launch consider a paid model with a no-training policy.
- **Abuse limits.** With confirmation off, anyone can create accounts. The AI function caps each account at 20 requests a day, but consider Supabase's CAPTCHA protection (Authentication → Attack Protection) before launch.
