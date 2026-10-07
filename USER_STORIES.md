# Liftly — User Stories

Format: **As a** beginner, **I want** ..., **so that** ....
Each story lists acceptance points. Terms follow PROGRESSION_ENGINE.md.

## Onboarding

**US-1** As a beginner, I want to choose a 3-day or 4-day program, so that my training fits my schedule.
- Program options are exactly 3-day and 4-day.
- The chosen program's workouts are shown in order.

**US-2** As a beginner, I want to preview my plan before creating an account, so that I know what I'm signing up for.
- The plan is viewable without an account.
- Saving a set requires an account.

**US-3** As a beginner, I want to create an account before saving my first workout, so that my history is kept.
- Account creation is prompted at the first save, not earlier.

## Workout calibration

**US-4** As a beginner, I want to find my starting weight for each new exercise, so that I don't start too heavy.
- The ramp starts at the bottom of the range with a light weight.
- The ramp moves up one ladder step per Easy set, and stops at the first Good set.
- A Hard or Failed set makes the previous step the working weight.

**US-5** As a beginner, I want the ramp sets clearly separated from my working sets, so that they don't count toward my volume.
- Ramp sets are logged as ramp, and are not counted in volume.

**US-6** As a beginner returning after more than 28 days, I want to restart calibration, so that my weights are safe again.
- Calibration starts at or below 50% of the last working weight.

## Workout logging

**US-7** As a beginner, I want to see today's target for each exercise, so that I know what to do.
- Each exercise shows target weight, target reps, and sets.

**US-8** As a beginner, I want to confirm a set with one tap when it matches the target, so that logging is fast.
- A matching set needs only the effort tap.

**US-9** As a beginner, I want to edit reps or weight when I did something different, so that my history is accurate.
- Edits are saved as the actual values.
- If the weight isn't on the gym's ladder, the app asks the user to confirm it. [ASSUMPTION]

**US-10** As a beginner, I want to tap how hard each set felt (Easy, Good, Hard, Failed), so that I don't need to count reps in reserve.
- Four buttons, always visible, one tap each.

**US-11** As a beginner, I want a rest timer that suggests the right rest, so that I rest enough between sets.
- Compound rest: 2–3 min. Isolation rest: 90 sec–2 min.

**US-12** As a beginner, I want to see my previous performance on each exercise, so that I can compare.
- Last session's weights and reps are visible on the exercise.

## Progression recommendations

**US-13** As a beginner, I want the app to tell me what to lift next, so that I don't have to guess.
- Next targets are calculated after each session using the decision table.

**US-14** As a beginner, I want to know why my weight went up, stayed, or went down, so that I trust the change.
- Every target has a reason code and a short explanation.

**US-15** As a beginner, I want the weight to change only on my gym's real loads, so that I can actually load the machine or dumbbell.
- No off-ladder weights.

**US-16** As a beginner on a large equipment step, I want the app to expect a harder start, so that I'm not penalized for the jump.
- After any increase, the next session's Miss floor drops by 2 reps for that exercise only.

**US-17** As a beginner, I want the app not to change my weight in the middle of a workout, so that I don't get confused.
- No weight changes during a session. A set below 6 reps lets me end that exercise.

## Missed workouts and comebacks

**US-18** As a beginner who missed a session, I want my next workout to still be the next one in the sequence, so that I'm not punished by the calendar.
- Workouts follow A → B → C (or U1 → L1 → U2 → L2) regardless of weekday.

**US-19** As a beginner returning after 8–14 days, I want slightly lighter weights, so that I can return safely.
- Working weight reduced to the highest ladder step ≤ 95% of last weight.
- The reason code `GAP_5` is shown.

**US-20** As a beginner returning after 15–28 days, I want lighter weights, so that I can return safely.
- Highest ladder step ≤ 90% of last weight.
- The reason code `GAP_10` is shown.

**US-21** As a beginner returning after more than 28 days, I want to restart calibration, so that my weights are reset safely.
- The `RECAL` code is shown, and the ramp runs.

## Progress tracking

**US-22** As a beginner, I want to see my weight over time for each exercise, so that I can see I'm improving.
- A chart per exercise, weight by session.

**US-23** As a beginner, I want to see my personal records, so that I can celebrate wins.
- [OPEN] Definition of a personal record is not in the frozen spec. Decide before build.

**US-24** As a beginner, I want to see how many sessions I completed each week, so that I can track consistency.
- Sessions-per-week count is shown.

## Pain handling

**US-25** As a beginner, I want to report pain on an exercise, so that the app doesn't push me into hurting myself.
- A "Report pain" action is available on each exercise during a workout.
- The exercise stops for the session, and the progression freezes.

**US-26** As a beginner, I want an alternative exercise next time after I report pain, so that I can keep training safely.
- The next exposure uses the approved swap, starting with the ramp.

**US-27** As a beginner, I want clear guidance when pain is serious, so that I know to get help.
- The professional-help screen appears for the conditions in SAFETY.md.
- The exercise is no longer prescribed.

**US-28** As a beginner, I want the original exercise to come back after I've been pain-free, so that I'm not stuck with the swap forever.
- The original returns after 2 pain-free sessions on the swap, at the frozen weight, as a first exposure.

## Claude-generated debriefs

**US-29** As a beginner, I want a short explanation after each workout, so that I understand my progress.
- Three to four sentences: a specific win with numbers, what changes next and why, and one practical tip.

**US-30** As a beginner, I want the debrief to explain the stall decision without making it, so that I understand the deload.
- Claude references the reason code and the engine's numbers.
- Claude doesn't change any number.

**US-31** As a beginner, I want the workout to work even when the debrief fails, so that I'm never blocked.
- If the debrief can't be generated, fixed text is shown and the session is saved.
