# Liftly — MVP Scope

## Included in V1

| Area | Included |
|---|---|
| Users | Beginners, 0–12 months of training, muscle-building goal, standard commercial gym |
| Platform | Web app, installable (PWA) |
| Program | Assigned 3-day (A/B/C) or 4-day (U1/L1/U2/L2) program |
| Units | kg only |
| Logging | Sets, reps, weight, effort tap (Easy/Good/Hard/Failed), rest timer |
| Progression | Progression Engine v1.0 (six-row decision table, reason codes, stall, gap, equipment ladders) |
| Calibration | Ramp to bottom-of-range with a Good effort |
| Pain | Report, stop, freeze, approved swap, professional-help screen |
| Plan | Sequence-based (not weekday-based) |
| Claude | Post-workout debrief; plan tailoring (picks among approved slot menus, revision 1.2) |
| Progress | Weight over time per exercise, personal records list, sessions per week |
| Account | Preview before sign-in; account required before the first saved workout |
| Offline | Logging works without a connection |
| Feedback | In-app feedback button for beta testers |

## Excluded or postponed

| Excluded from V1 | Reason |
|---|---|
| Coach chat or free-form questions | Keeps Claude's role narrow and testable |
| Nutrition guidance | Later phase |
| Claude-invented plans; custom routine builder; user-created exercises | Engine must stay deterministic and the exercise library fixed. (Claude may only pick among approved slot menus, revision 1.2.) |
| Numeric RPE/RIR input | Effort taps keep logging simple for beginners |
| Strength / powerlifting goals; periodization | Beginner, muscle-building scope only |
| Native iOS / Android apps | Web app first |
| Wearables; Apple Health; Google Health Connect | Not needed to validate progression |
| Social features, leaderboards, sharing | Not needed for the beta |
| Payments and subscriptions | Free beta |
| Home workouts | Gym-only scope |
| Form analysis from video | Not needed for V1 |
| Other units (lbs), languages, markets | India/kg only |
| Graduating users to harder programs | Possible V1.5 |

## Open scope decision

| Item | Status |
|---|---|
| Weekly review (Claude) | [OPEN] Listed in the original MVP definition, but not part of the frozen Progression Engine v1.0 or the Phase 0 test. Decide whether it is in V1 before build. Until decided, it is excluded. |

## Product boundaries

1. **Engine decides, Claude explains.** Claude never sets or changes weights, reps, sets, or progression, and never chooses exercises except among the approved slot menus, validated by the app (revision 1.2).
2. **Fixed exercise library.** Users pick from the approved library and its approved swaps only.
3. **No medical role.** Liftly does not diagnose pain, injury, or medical conditions.
4. **Beginner-first.** Features that serve advanced lifters are out of scope.
5. **Spec freeze.** Progression rules, calibration, pain rules, and programs match v1.0 exactly. Changes require a new numbered version.
