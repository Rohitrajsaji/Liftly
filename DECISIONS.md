# Liftly — Decisions

Decisions that close contradictions between the spec documents, and the defaults the code uses for items that are still open. Progression Engine v1.0 rules are unchanged; entries here only clarify how conflicting statements are read.

Architecture plan (approved 2026-10-07): https://claude.ai/code/artifact/2123b995-f957-49d9-99cf-1100086aad6a

## 1. Resolved contradictions (approved by Rohit, 2026-10-07 and 2026-10-08)

| # | Topic | Decision | Docs updated |
|---|---|---|---|
| C1 | First exposure after calibration | The calibration (ramp) session itself is the first exposure, including the ramp that starts a swap. Its working sets use the Miss floor B − 2. The following session uses floor B unless the weight was increased. | README terminology, PROGRESSION_ENGINE §8, TESTING conventions |
| C2 | Ladder scope | One ladder per exercise per gym, created from an equipment-type template. | DATA_MODEL |
| C3 | Second pain report within 4 weeks | Swap becomes permanent, the professional-help screen shows, and the original exercise is removed from prescriptions (SAFETY §3 applies as written). | TESTING P-07 |
| C4 | Claude and pain wording | Claude may name `PAIN_SWAP` and say the exercise changes next session. All pain and swap wording is fixed text (SAFETY §5) rendered by the app outside Claude's text. | AI_COACH §1, §5 |
| C5 | One reason code per target | Each prescription has one reason code. When a gap applies, the gap code (`GAP_5`, `GAP_10`, `RECAL`) is the code. A first-time calibration has decision type calibration and no code. | TESTING R-01, R-02; DATA_MODEL |
| C6 | "Decision happens at the next session" | The engine runs after the session on the sets actually logged. The new weight is first used at the next session. | PROGRESSION_ENGINE §10 |
| C7 | First save without an account, offline | The in-progress workout stays on the device, unsynced, and attaches to the account when sign-in succeeds. Nothing is uploaded before the account exists. | PRD AC-2 |
| C8 | Calibration flag | Calibration is recorded per exercise (decision type, ramp sets). The session flag is derived. | DATA_MODEL |
| Q1 | Deload after a weight increase (TESTING L-03, L-05) | Engine rule unchanged: 0.90 × the weight just lifted, then the highest step at or below it on that exercise's real ladder. L-03 and L-05 corrected to 8 kg; L-09 added for a 5, 7.5, 10 kg ladder (→ 7.5 kg). Decided 2026-10-08. | TESTING L-03, L-05, L-09; ENGINE_QUESTIONS Q1 |
| P1 | Swap-only exercise metadata (PROGRAMS_QUESTIONS PQ1) | Class and equipment set by Rohit for the 11 swap-only exercises; all are now in PROGRAMS.md §3a. "Overhead Triceps Extension" is named Overhead Cable Triceps Extension (isolation, cable). Decided 2026-10-08. | PROGRAMS §3a |
| P2 | Swaps that duplicate an exercise in the same workout (PQ2) | 4-day Upper 2: Seated Cable Row now swaps to One-Arm Dumbbell Row. 4-day Lower 1: Leg Extension now swaps to Goblet Squat. Decided 2026-10-08. | PROGRAMS §3 4-day, §3a |
| P3 | 45-Degree Back Extension progression (PQ3) | Kept. The ladder holds added load: 0 kg is bodyweight only, then the loads the user's gym actually has. The engine accepts a 0 g ladder step; every rule runs unchanged on the added load. Covered by TESTING L-10 to L-13. Decided 2026-10-08. | PROGRAMS §6, TESTING L-10..L-13, DATA_MODEL |
| P4 | Assisted Pull-up (PQ4) | Removed as a V1 swap (its ladder runs backwards). Replaced by Machine Pulldown (compound, machine, 8–12) in both programs. Decided 2026-10-08. | PROGRAMS §3, §3a |
| P5 | One-Arm Dumbbell Row (PQ5) | Confirmed: compound, dumbbell, 8–12 reps. Decided 2026-10-08. | PROGRAMS §3a |
| P6 | Gym weights set up front | Every exercise starts on a standard commercial-gym list so no setup is needed: machine 5–150 kg every 5, cable 2.5–80 every 2.5, dumbbell 2.5–50 every 2.5, bodyweight 0 then 2.5–30 every 2.5. The user can change any list (Gym weights). The engine still only moves along the list in use, and each session stores the list it used. Rohit, 2026-10-10. | apps/web/src/gym.ts |
| P7 | AI plan tailoring (draft, awaiting menu sign-off) | Rohit chose "AI tailors plan" on 2026-10-10 and said "proceed" on the proposal. The AI picks one exercise per slot from the approved menus (PROGRAMS 3b); the app validates every pick; a rules plan (no AI) honours the user's answers whenever the AI is unavailable or invalid. Sets, slots, order, engine and pain rules are unchanged. Session length and focus questions dropped because nothing in a frozen structure can act on them. | PROGRAMS 3b, AI_COACH 4a, TESTING T-01 to T-13 |
| U1 | Goal confirmation step (web app, M4.1) | Removed as a step. The only V1 goal, "build muscle", is shown as information on the welcome screen and the plan preview (Rohit, 2026-10-08). PRD F1 "goal confirmation" is met by showing the goal | PRD F1, MVP_SCOPE |

## 2. Defaults used by the code for open items (not decided)

These are not decisions. Each is a named constant or a single function in `packages/engine/src/assumptions.ts`, and the tests that depend on it are tagged so they can be listed. Changing one is a one-line change plus a test update.

| Open item | Default in code | Source |
|---|---|---|
| Fast-up window boundary | Day 21 is inside the window (inclusive) | README #4, TESTING B-01 |
| Stall interpretation | Compare current total reps with the first of the last three exposures at this weight | README #3, ENGINE §7 |
| Bottom of the ladder | No step at or below the target: keep W if W is the lowest step, otherwise use the lowest step; set a `ladder_edge` data flag | README #6, TESTING G-08 |
| Top of the ladder | No higher step: keep W, set a `ladder_edge` data flag; the reason code is still the row's code | README #6, TESTING L-08 |
| Swap of a swap | Row 1 applies to the swap exercise; the original stays frozen | README #12, TESTING P-09 |
| Partial exercise | The table runs on the working sets logged; sets not done are not misses | Architecture plan, gaps |
| Gap applied to a pending increase | Gap factor applies to the last working weight, as ENGINE §6 says | Architecture plan, gaps |
| Gap session target reps | B | Architecture plan, gaps |
| Gap cut and first exposure | A gap cut is not a first exposure (ENGINE §8 lists increases only) | Architecture plan, gaps |
| Calibration start | Lowest ladder step; for `RECAL`, highest step ≤ 50% of W | Architecture plan, gaps |
| Hard or Failed when no lower ladder step exists | That step becomes the working weight (`ladder_edge` flag) | Architecture plan, gaps |
| 5th ramp set still Easy | That load is the working weight; the 5th set stays a ramp set and does not count as working set 1 | ENGINE §4 (only a Good set is stated to count) |
| Serious pain and the swap | The swap takes the removed exercise's slot, starting with a ramp | Architecture plan, gaps |
| Stall counter on first exposure | A first exposure at a new weight starts the window at 1 | ENGINE §7 (counter resets on weight change) |
| More than 12 months of training at onboarding (web app, M4) | Allowed. The answer is stored as entered and a one-line note says Liftly is built for about the first 12 months | MVP_SCOPE users 0–12 months; nothing says what to do above it |
| Sign-in method (M5) | Email + password (min 8 characters), Supabase "Confirm email" OFF, no password reset yet. Changed from email one-time code because the code needs a custom email template, which Rohit's Supabase plan does not allow. Google sign-in is left for later. Before outside testers: confirmation + custom SMTP + reset flow | Rohit, 2026-10-10 (replaces 2026-10-08 email-code choice) |
| AI debrief (M8) | The debrief model is called only from a Supabase Edge Function that holds the OpenRouter key (never in the app or Git). Changed from Claude (Anthropic) to the free OpenRouter model `nvidia/nemotron-3-ultra-550b-a55b:free` (Rohit, 2026-10-10, to avoid cost); the model is a secret-configurable `DEBRIEF_MODEL`. Because the validator checks every output, the model can be swapped without touching safety. Caveats: free models may log or train on prompts (the consent text says so), are rate limited and slower, and AI_COACH.md names Claude, so that doc needs a wording update if this stays. Reliability: the function tries each model in `DEBRIEF_MODELS` (default Nemotron free, then `openrouter/free`) with a ~55 s budget and only counts a request toward the daily cap when it produced an answer; on a rate limit it returns 429 with `retry_after`. The app queues requests one at a time, backs off 1 min, 5 min, 30 min, 2 h (or the server's wait if longer), retries on start, reconnect and a timer, and treats a rate limit as a failed attempt only after 6 back-offs; offline never counts. Optional per user (off until turned on in Account, consent `ai-debrief-draft-2`); the function refuses without that consent and caps 20 requests per account per day (`debrief_log`). The app saves fixed text first and replaces it only with output that passes validation (numbers from the input, reason codes from the input, no forbidden terms, 3–4 sentences, ≤ 90 words); one retry later after a failed attempt (offline, consent and rate limits do not count). Pain details sent: exercise and mild/moderate/high only; pain wording is never the model's. Fixed fallback wording and the 90-word limit are drafts | Rohit, 2026-10-10 |
| Sync conflicts (M5) | Append-only rows (sets, decisions, consents) carry client-made ids, so a retried upload never duplicates. The one editable row, the profile, keeps the newest `updated_at`; a stale write from an offline phone is ignored | TESTING O-03, PRD FR-15 |
| Account deletion scope (M5) | Deleting the account deletes the user and every row linked to it, including consent records, in one step | SAFETY §6 open item (retention period and deletion scope still open) |
| Onboarding answers at sign-in (M5) | The answers kept on the device attach to the account at sign-in. If the account already has a profile and the device has none, the account's profile is used. If both exist, the newer one wins | DECISIONS C7 |
| Consent text (M5) | `draft-1` in `apps/web/src/consent.ts`, shown before an account is created and stored with the date. Needs Rohit's review | SAFETY §6 |
| Gym weights are typed in (M6) | The user lists the loads their gym has per kind of equipment (machine, cable, dumbbell, bodyweight) and may give one exercise its own list. Liftly assumes no increment and offers no default list. A list needs at least two steps; 0 kg is allowed only for bodyweight (added load) exercises | Rohit's rule: progression uses the actual gym ladder |
| Pain on a swap (M6) | The swap is stopped for the session and the slot is paused (left out of workouts, with fixed text) until a future decision. The original stays frozen | TESTING P-09 covers the engine row only; **new question PQ6: what should a paused slot do next?** |
| Original returns after pain (M6) | After two pain-free swap sessions the original returns at its frozen weight as a first exposure, with no reason code (as a stored target) | SAFETY 2.4, TESTING P-08 |
| Calibration Good set (M6) | A Good ramp set is logged as working set 1; the other ramp sets are excluded from volume | ENGINE §4, CLAUDE.md |
| Weight is fixed once a set is logged (M6) | Before the first set the user may pick a different ladder step (for a ramp: where it starts; after a break of more than 28 days only at or below the engine's start). After the first set the weight cannot change | ENGINE §10 |
| Workouts are stored as events (M6) | A finished workout is one append-only `events` row (jsonb, unique client id); a pain follow-up answer is another. The plan is rebuilt from them, so a new phone gets the same targets. Gym weights are `ladders` rows, newest wins. Migration `0002_workouts.sql` | DATA_MODEL replay requirement |
| Rest timer (M6) | Counts up from the last logged set; suggested rest compound 2–3 min, isolation 1.5–2 min, ramp 1–2 min. It is a guide and never blocks logging | PROGRAMS.md rest table |
| Sign-in prompt (M6) | Workouts are saved on the phone with no account. A non-blocking note appears after the first set and on the summary; signing in uploads everything | DECISIONS C7 |
| Pain follow-up (M6) | One day after a pain report the Today screen asks whether it is still there; the answer is saved as an event | SAFETY 24-hour rule |
| Look (M6) | Soft neumorphic UI after Rohit's references (2026-10-08): grey surfaces, raised and pressed shapes, Poppins, orange accent only for the main action, selection text and progress. Safety messages keep a tinted background so they stand out | Rohit |
| Personal record (M7) | The heaviest weight lifted for at least the bottom of the exercise's rep range in a working set; ties go to more reps. A Failed attempt below that is not a record | PRD F14 does not define "record" |
| Progress charts (M7) | Weight over time is the heaviest working-set weight per session (added load for bodyweight exercises); warm-up sets are left out. Workouts per week count Monday to Sunday over the last 8 weeks, partial workouts included | PRD F14 |
| Progress and history source (M7) | Computed on the device from finished workouts, nothing stored separately, so they work offline and rebuild on a new phone | DATA_MODEL |
