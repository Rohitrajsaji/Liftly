# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Architecture approved 2026-10-07 (plan and resolved contradictions in `DECISIONS.md`). Code so far: the progression engine, `packages/engine`, a zero-dependency TypeScript package. No app, database or Claude integration yet. Spec documents stay at the repository root (not moved to `docs/`).

Fixed platform decisions: installable web app (PWA), kg only, India market, offline logging.

## Commands

Node 22 and pnpm 10. From the repository root:

- `pnpm install`
- `pnpm check`: typecheck and all tests
- `pnpm test` / `pnpm typecheck`
- One test file: `pnpm --filter @liftly/engine exec vitest run test/scenarios/stall.test.ts`
- One scenario by ID: `pnpm --filter @liftly/engine exec vitest run -t "S-04"`
- Tests resting on an open item: `pnpm --filter @liftly/engine exec vitest run -t "OPEN|ASSUMPTION|SPEC QUESTION"`

## Engine code rules

- `packages/engine/src` imports nothing outside itself and never reads the clock, randomness, network, storage or Claude (`test/purity.test.ts` enforces this).
- Loads are integer grams everywhere inside the engine; factors are per-mille (`900` = 0.90). Convert kg only at the app's edges (`kgToG`).
- Defaults for [OPEN]/[ASSUMPTION] items live in `src/assumptions.ts` or in the one function marked "(default)", and are listed in `DECISIONS.md` section 2.
- Every TESTING.md scenario has a test whose name starts with its ID (`test/coverage.test.ts` enforces this). Never edit an expected value to make code pass: record the conflict in `ENGINE_QUESTIONS.md` and leave the test red.

## How the spec is organized

`README.md` holds the document map, reading order, terminology, and the numbered list of **open items that must be decided before build**. Read it first. The core rules live in:

- `PROGRESSION_ENGINE.md`: the frozen v1.0 engine (rep ranges, effort taps, ladders, calibration, six-row decision table, gap, stall, jump, constants, reason codes, worked examples).
- `SAFETY.md`: locked pain policy, the conditions that trigger the professional-help screen, and which messages are fixed text vs. Claude-written.
- `AI_COACH.md`: Claude's only V1 output (post-workout debrief), its input block, structured output, validation, and fallback.
- `DATA_MODEL.md`: conceptual entities; a decision record must store everything needed to replay it.
- `TESTING.md`: scenario tables with exact expected outputs (IDs like D-01, B-03, C-04, S-01, G-06, P-01, L-05, A-02, O-02).

Markers: `[ASSUMPTION]` is a proposal to confirm, `[OPEN]` is a decision needed before build. Do not silently resolve either; surface it.

## Architecture rules that cut across documents

**Engine decides, Claude explains.** The progression engine is a deterministic, pure function of stored data (sets, days since last session, ladder, history, engine version). Claude never sets or suggests weights, reps, sets, progression, or exercises. Logging, the engine, pain handling, and progress tracking must work with Claude unavailable and with no network.

**Spec freeze.** Engine, calibration, pain rules, and programs must match v1.0 exactly. Any rule change needs a new numbered spec version (and a safety review if it touches progression, pain, or Claude's role). Per `TESTING.md` §12, a failing scenario is a spec question, not something to "fix" in code.

**Engine details that are easy to get wrong:**
- Decision table rows are checked top to bottom; first match wins. Row 1 pain beats everything.
- A set is one Miss if below the bottom of the range *or* tapped Failed; a set that is both is still one miss.
- On a first exposure (after any weight increase, swap, or calibration) the Miss threshold is B − 2 for that session only.
- All weight changes move along the gym's ladder ("highest step ≤ 0.90 × W", "+1 step"). Never compute an off-ladder weight. Ladder rounding can make cuts larger than the nominal percentage; that is expected.
- The `JUMP` (>10% increase) and first-exposure markers are data flags, not reason codes, and never block an increase.
- Gap adjustment is applied when prescribing the first session after a break, based on days since the last session of any kind; >28 days means recalibrate.
- Stall counter resets on any weight change and on any break >14 days. Stall compares current total reps with the first of the last three exposures (interpretation still [OPEN]).
- No weight changes during a workout. Ramp sets are logged as ramp and excluded from volume; a ramp set tapped Good becomes working set 1.

**Claude debrief pipeline.** The app builds a pseudonymous structured input block (no names, emails, or phone numbers; injury notes excluded unless the user opts in). User notes are passed as data and any instructions inside them must be ignored. Claude returns a structured object (`debrief_text`, `reason_codes_cited`, `numbers_cited`, `contains_pain_guidance`, `units`). The app validates it: every number must appear in the input, reason codes must come from the input, no diagnostic/medical language, length limit. On any failure, unavailability, or timeout, show fixed fallback text per reason code, log the failure, and retry once later without showing partial output.

**Safety messaging.** Pain stop, serious-pain screen, and swap explanations are fixed templates, never Claude output. Liftly never diagnoses, names causes, says training through pain is safe, or recommends treatment, medication, or supplements.

## V1 scope boundaries

Out of scope for V1 (see `MVP_SCOPE.md` and `FUTURE.md`): coach chat, weekly review (open, excluded until decided), nutrition, custom routines or user-created exercises, numeric RPE/RIR, lbs, native apps, wearables, social features, payments. Exercises and swaps come from a fixed library. The exact program exercise lists are in `PROGRAMS.md` (source of truth); never invent exercises.
