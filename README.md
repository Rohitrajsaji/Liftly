# Liftly

Liftly is a workout app for gym beginners. It tells you what to lift next, and why, based on your own training history. A deterministic progression engine sets every number. Claude explains the decisions.

## Status

- **Progression Engine v1.0:** frozen.
- **Phase 0 (manual testing with 3–5 beginners):** ready to run once gym load ladders are recorded.
- **Architecture and tech stack:** approved 2026-10-07 (TypeScript monorepo, React + Vite PWA, Supabase, progression engine as a pure package). See the architecture plan linked in DECISIONS.md.
- **Code:** progression engine in `packages/engine`; frozen programs and exercise library in `packages/catalog`; installable web app in `apps/web` (M4 and M5: onboarding, plan preview, email-code accounts, sync, offline); Supabase schema in `supabase/migrations`. See CLAUDE.md for commands.
- **Programs:** frozen 3-day and 4-day programs in PROGRAMS.md.

## Document map

| File | Purpose |
|---|---|
| [PROJECT_GOAL.md](PROJECT_GOAL.md) | What Liftly is, the target user, the core problem, the product promise, success definition |
| [PRD.md](PRD.md) | MVP overview, features, screens, flows, functional requirements, acceptance criteria |
| [MVP_SCOPE.md](MVP_SCOPE.md) | What is in V1, what is excluded, product boundaries |
| [USER_STORIES.md](USER_STORIES.md) | User stories by area, with acceptance points |
| [PROGRESSION_ENGINE.md](PROGRESSION_ENGINE.md) | The engine: rep ranges, effort, calibration, ladders, decision table, reason codes, stall, gap, jumps, examples |
| [AI_COACH.md](AI_COACH.md) | Claude's role, its inputs and outputs, what it may and may not do, fallbacks |
| [DATA_MODEL.md](DATA_MODEL.md) | Entities, fields, relationships (conceptual; no database chosen) |
| [UX.md](UX.md) | Design principles and gym-environment requirements |
| [SAFETY.md](SAFETY.md) | Pain policy, stop conditions, fixed vs. Claude messaging, privacy |
| [TESTING.md](TESTING.md) | Test scenarios with expected outputs |
| [FUTURE.md](FUTURE.md) | Postponed features and when to revisit them |
| [PROGRAMS.md](PROGRAMS.md) | Frozen 3-day and 4-day V1 programs (source of truth) |
| [DECISIONS.md](DECISIONS.md) | Resolved contradictions and the defaults the code uses for open items |
| [ENGINE_QUESTIONS.md](ENGINE_QUESTIONS.md) | Engine spec questions raised by failing tests, and their resolutions |
| [SUPABASE_SETUP.md](SUPABASE_SETUP.md) | What to create and configure in Supabase, and which values to send |
| [PROGRAMS_QUESTIONS.md](PROGRAMS_QUESTIONS.md) | Gaps in PROGRAMS.md found while building the program catalog |

## Recommended reading order

1. **PROJECT_GOAL.md**: what and why.
2. **MVP_SCOPE.md**: what's in and out.
3. **PROGRESSION_ENGINE.md**: the core rules.
4. **SAFETY.md**: pain and medical boundaries.
5. **AI_COACH.md**: Claude's role.
6. **PRD.md**: requirements and acceptance.
7. **USER_STORIES.md**: user-level detail.
8. **DATA_MODEL.md** and **UX.md**: structure and experience.
9. **TESTING.md**: how to verify.
10. **FUTURE.md**: what's deliberately not in V1.

## Source of truth

- The approved **Liftly MVP definition** and the frozen **Progression Engine v1.0** are authoritative.
- Where a document says [ASSUMPTION], the item is a proposal to confirm, not a decision.
- Where a document says [OPEN], a decision is needed before build.
- Earlier drafts (the first Phase 0 document and the e1RM calibration draft) are **superseded** by v1.0.

## Terminology

| Term | Meaning |
|---|---|
| User | A person using Liftly (called "tester" in Phase 0 spreadsheets) |
| Program | 3-day (A, B, C) or 4-day (U1, L1, U2, L2) |
| Exposure | A session in which an exercise was prescribed at a given weight |
| First exposure | The session right after a weight increase, and the calibration (ramp) session itself, including the ramp that starts a swap. Miss floor B − 2 for that session only (see DECISIONS.md, C1) |
| Ladder | The list of loads a gym actually has for an exercise |
| Working weight (W) | The last weight used for working sets |
| Miss | A set below the bottom of the range, or tapped Failed |
| Ramp | Calibration sets, not counted toward volume |
| Reason code | The label the engine attaches to every decision |
| Jump | An increase of more than 10% (flag only) |

## Open items (decisions needed before build)

1. **Weekly review:** in or out of V1? Not in the frozen spec.
2. **Personal record definition:** not in the frozen spec.
3. **Stall interpretation:** confirm "compare with the first of the last three exposures" (PROGRESSION_ENGINE.md section 7).
4. **Fast-up boundary:** confirm whether day 21 counts (TESTING.md B-01).
5. **Ladder rounding:** on small ladders, deloads and gap cuts can be larger than the stated percentage (for example −12.5% instead of −10%). Review in Phase 0.
6. **Bottom and top of ladder:** what happens when no lower or higher step exists (TESTING.md G-08, L-08).
7. **Ladder entry:** how users record their gym's ladders inside the app.
8. **Pain screen wording:** final text, reviewed by a qualified professional.
9. **Fixed debrief fallback text:** one message per reason code.
10. **Privacy:** consent text, retention period, deletion scope, and third-party list (including the AI provider). Legal check against Indian data protection law.
11. **Sync conflicts** when offline sessions are uploaded.
12. **Swap of a swap:** what happens when the approved swap also causes pain (TESTING.md P-09).
