# Liftly — UX Principles and Requirements

These are design requirements. Visual style is not decided. Items marked [ASSUMPTION] are proposals to be validated in Phase 0.

## 1. Beginner-first principles

1. **Say what to do.** Every screen answers "what do I lift now?" before anything else.
2. **Explain in one line.** Every target has a short reason. Detail is one tap away.
3. **No jargon without a definition.** RIR, RPE, deload, and ladder are explained at first use.
4. **Show uncertainty honestly.** If the app doesn't know something (no ladder yet, no history), it says so.
5. **Never block the workout.** Errors in Claude, sync, or the debrief never stop logging.

## 2. Minimal-tap workout logging

- A set that matches its target needs **one tap** (the effort button).
- Edits take one tap to open, and two taps at most to change reps or weight.
- The effort buttons (Easy, Good, Hard, Failed) are always visible for the set in progress.
- The next set is one tap away.
- Large tap targets for use with sweaty hands and between sets.

## 3. Showing previous performance

- Each exercise shows last session's **weight and reps per set**.
- The reason code for today's target appears in one line.
- The history view is one tap from the exercise.

## 4. Showing today's target clearly

- Today's workout (A, B, C or U1, L1, U2, L2) is the first thing on the home screen.
- Each exercise shows: **target weight, target reps, sets**.
- Targets are always on a ladder weight. The app never shows an off-ladder weight.
- If an exercise is paused (pain) or swapped, it is labelled clearly on its card.

## 5. Calibration UX

- The ramp screen explains the process in one sentence: "Start light and go up one step at a time until 8 reps feel Good."
- Each ramp set is labelled **Ramp** and shows its load.
- When the working weight is set, the screen says so: "Your working weight: 10 kg."
- [ASSUMPTION] Users can't skip calibration on a new exercise.

## 6. Effort buttons

- Four labels: **Easy, Good, Hard, Failed**.
- Each has a short helper line, shown once or on tap: "Easy: plenty left in the tank," and so on.
- Failed means "couldn't reach the target reps". It is not a tap for pain.

## 7. Pain reporting

- A "Report pain" action is available on every exercise during a workout.
- It is not hidden behind menus.
- The screen asks where, how severe (0–10), and the screening questions from SAFETY.md.
- After reporting, the app says what happens next, in fixed text.
- Pain reporting never requires typing.

## 8. Progress screen

- Weight over time per exercise (one chart per exercise).
- Personal records list [OPEN: definition].
- Sessions completed each week.
- Plain language, no unexplained graphs.

## 9. Offline-friendly expectations

- Logging, targets, and progression work with no connection.
- A visible but unobtrusive indicator shows when data is waiting to sync.
- Data is not lost if the app is closed or the phone loses signal mid-workout.
- [ASSUMPTION] If the debrief can't be generated, the app says it will appear when the user is back online.

## 10. Gym-environment constraints

- Users are often mid-set, with one hand free and the phone on a bench.
- Text is readable at arm's length, in bright and dim lighting.
- No required typing during a set.
- [ASSUMPTION] The rest timer keeps running when the app is in the background, where the device supports it.
- Battery use matters: avoid heavy animation during a workout.

## 11. Accessibility basics

- Sufficient colour contrast for all effort buttons and targets.
- Effort is never shown by colour alone; each effort has a label.
- Works with the phone's text-size setting.
