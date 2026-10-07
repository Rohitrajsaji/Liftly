# Liftly — Product Requirements (MVP)

Source of truth: Liftly MVP definition and Progression Engine v1.0 (frozen). Where a requirement is not in the frozen spec, it is marked [ASSUMPTION] or [OPEN].

## 1. MVP overview

Liftly V1 is a web app for beginners training to build muscle, following a 3-day or 4-day program. It covers onboarding, workout logging, the progression engine, pain handling, missed-workout adaptation, progress tracking, and Claude-generated post-workout debriefs.

## 2. Core features

| # | Feature | Summary |
|---|---|---|
| F1 | Onboarding | Training experience, program choice (3-day or 4-day), goal confirmation |
| F2 | Plan preview | Users can see their plan before signing in |
| F3 | Account creation | Required before the first workout is saved |
| F4 | Exercise library | Beginner exercises, each with rep range and an approved swap |
| F5 | Gym load ladders | Each gym's real available loads per exercise, used for every weight change |
| F6 | Today's workout | Targets shown for each exercise, with previous performance |
| F7 | Workout logging | Confirm or edit reps and weight, tap effort per set, rest timer |
| F8 | Calibration | Ramp procedure to find the starting weight for each new exercise |
| F9 | Progression engine | Deterministic next-target decisions with reason codes (Progression Engine v1.0) |
| F10 | Sequence-based plan | Workouts follow an ordered sequence, not fixed weekdays |
| F11 | Gap / comeback handling | Weight adjustments after breaks |
| F12 | Pain reporting | Stop, freeze, swap, and professional-help screen |
| F13 | Claude debrief | Short post-workout explanation |
| F14 | Progress view | Weight over time per exercise, personal records, sessions per week |
| F15 | Offline logging | Logging keeps working without a connection; sync later |
| F16 | Feedback button | In-app feedback for beta testers |

## 3. Main screens

1. Welcome and onboarding
2. Plan preview
3. Create account / sign in
4. Home (today's workout)
5. Workout screen (exercise list, set logging, effort tap, rest timer)
6. Calibration screen (ramp)
7. Pain report screen
8. Professional-help screen (fixed message)
9. Post-workout debrief
10. Progress screen
11. History
12. Gym setup (load ladders and swaps) [ASSUMPTION: needed to record ladders in-app; see OPEN in README]
13. Feedback

## 4. User flows

**First use**
1. Onboarding → choose 3-day or 4-day program.
2. Plan preview (no account yet).
3. Create account (required before saving).
4. First workout: calibration for each new exercise, then working sets.
5. Post-workout debrief.

**Regular session**
1. Home shows today's workout (next in the sequence).
2. Confirm or edit each set; tap effort per set.
3. Engine calculates next targets (after the session).
4. Debrief appears; next targets are already stored.

**Pain**
1. User taps Report pain during an exercise.
2. Exercise stops for the session. Progression freezes.
3. Next exposure uses the approved swap (calibration).
4. If a serious-pain condition applies, the professional-help screen shows and the exercise is no longer prescribed.

**Missed workouts**
1. The sequence doesn't depend on weekdays. The next workout is whatever comes next.
2. On return, the gap adjustment applies to the first session back.

## 5. Functional requirements

Each requirement traces to the frozen spec unless marked otherwise.

- **FR-1** The app assigns a 3-day (A/B/C) or 4-day (U1/L1/U2/L2) program from the chosen option. Exercise lists match the frozen spec.
- **FR-2** The plan can be previewed before sign-in. Saving any workout requires an account.
- **FR-3** Each exercise has a rep range: compound 8–12, isolation 10–15.
- **FR-4** Each set can be tapped with one of: Easy, Good, Hard, Failed. Failed means the target reps weren't reached.
- **FR-5** Each exercise has its own load ladder recorded for the user's gym. All weight changes move along this ladder.
- **FR-6** A new exercise (or a swap, or a return after more than 28 days) runs the calibration (ramp) procedure.
- **FR-7** After each session, the engine applies the six-row decision table (see PROGRESSION_ENGINE.md) to each exercise, in order, and stores the result with its reason code.
- **FR-8** Gap adjustments apply to the first session after a break, based on days since the last session of any kind.
- **FR-9** Pain reported on an exercise stops that exercise for the session, freezes progression, and sets the next exposure to the approved swap.
- **FR-10** Two pain reports on the same exercise within 4 weeks make the swap permanent.
- **FR-11** The app never changes weight during a workout.
- **FR-12** Debriefs are generated after each session. Claude receives structured input only (see AI_COACH.md).
- **FR-13** If Claude is unavailable, logging, targets, and progression still work; the debrief falls back to fixed text.
- **FR-14** Every decision, set, pain report and override is stored (see DATA_MODEL.md).
- **FR-15** Logging works offline and syncs when a connection returns. [ASSUMPTION: sync conflict behavior not specified]
- **FR-16** Units are kg. Loads are stored in kg.

## 6. Acceptance criteria

- **AC-1 Program:** selecting 3-day yields workouts A, B, C in that order. Selecting 4-day yields U1, L1, U2, L2 in that order. Exercises and set counts match the frozen spec exactly.
- **AC-2 Preview before sign-in:** the plan can be viewed with no account. Attempting to save a set without an account prompts sign-in. Nothing is uploaded until the account exists; the in-progress workout is kept on the device only and attached to the account when sign-in succeeds (DECISIONS.md, C7).
- **AC-3 Ladder:** a weight change always lands on a value in that gym's ladder. No computed off-ladder weights are ever shown.
- **AC-4 Decision table:** given any recorded session, the engine returns exactly one row's result, matching the test cases in TESTING.md.
- **AC-5 Reason codes:** every target shown has a reason code, and the debrief references only codes the engine returned.
- **AC-6 Pain:** a pain report on an exercise prevents any weight increase for that exercise at its next exposure, and the next exposure uses the swap.
- **AC-7 Calibration:** the ramp stops at the first Good set (or after five Easy sets, per the spec), and uses the spec's rule for Hard/Failed.
- **AC-8 Gap:** the first session after an 8–14 day break shows the 5% step-down. After more than 28 days, the calibration procedure runs.
- **AC-9 Offline:** a set logged with no connection is stored locally and appears in history after sync.
- **AC-10 Debrief fallback:** if the Claude call fails, the session still saves and targets still display; the debrief shows fixed text.
