# Liftly — Progression Engine (v1.0, frozen)

This document restates Progression Engine v1.0 for the project. Rules here must exactly match the approved v1.0 specification. If the two disagree, the approved spec wins.

## 1. Rep ranges

| Exercise type | Bottom (B) | Top (T) | Sets |
|---|---|---|---|
| Compound | 8 | 12 | As listed in the program (3 for most compounds) |
| Isolation | 10 | 15 | As listed in the program (2 or 3) |

## 2. Effort scale

| Tap | Meaning (approximate reps in reserve) |
|---|---|
| Easy | 4 or more reps left |
| Good | 2–3 reps left |
| Hard | 0–1 reps left |
| Failed | Target reps not reached |

**Miss:** a set below B, **or** tapped Failed. One set counts as one miss, even if it is both.

## 3. Load ladder

- Each exercise has a **ladder**: the list of loads that actually exist at the user's gym for that equipment.
- Every weight change moves along the ladder ("one step up", "two steps up", "highest step at or below X").
- Nothing is computed as a percentage and then rounded to an arbitrary value.
- Load definitions:
  - Barbell: total, including the bar.
  - Dumbbell: per hand.
  - Machine and cable: the displayed value.

**Example ladder (for illustration only, not a real gym):** 6, 8, 10, 12, 14, 16, 18, 20, 22 kg.

## 4. Calibration (ramp)

Used for: a new exercise, a swap, a return after more than 28 days.

1. **Start light.** Pick a load the user is sure is Easy at the bottom of the range. After a return from more than 28 days, start at or below 50% of the last working weight.
2. **Do the bottom-of-range reps** (8 for compound, 10 for isolation). Tap the effort. Rest 1–2 minutes between attempts.
3. **Respond to the tap:**
   - **Easy:** move up one ladder step and repeat. At most 5 ramp sets. If the 5th is still Easy, that load becomes the working weight.
   - **Good:** this is the working weight. **This set counts as working set 1.**
   - **Hard or Failed:** the working weight is the **previous** ladder step. Do all working sets at that weight.
4. **Complete the remaining working sets** at the working weight. The session counts as a first exposure.
5. **Ramp sets** are logged as ramp, and are not counted toward volume.

## 5. Progression decision table

Run after each session, for each exercise. W = last working weight. Check rows top to bottom. **The first matching row wins.**

| # | Condition | Next prescription | Reason code |
|---|---|---|---|
| 1 | Pain reported on this exercise | Stop the exercise for this session. Next exposure uses the swap (section 9). | `PAIN_SWAP` |
| 2 | 2 or more working sets are Miss | Highest ladder step ≤ 0.90 × W. Target = B. | `DELOAD_MISS` |
| 3 | Lowest set ≥ T, **and** all sets Easy, **and** (within 21 days of this exercise's first session, **or** lowest set ≥ T + 2) | +2 ladder steps. Target = B. Next session is a first exposure. | `FAST_UP` |
| 4 | Lowest set ≥ T (any effort) | +1 ladder step. Target = B. Next session is a first exposure. | `ADVANCE` |
| 5 | Stall: same W for 3 exposures, and total reps not higher than at the first of those exposures (see section 7) | Highest ladder step ≤ 0.90 × W. Target = B. | `STALL_DELOAD` |
| 6 | Anything else | Same W. Target = lowest set's reps + 1, with a minimum of B and a maximum of T. | `HOLD_PUSH` |

**Notes**
- Row 2 counts Miss sets. Row 6 applies when there is at most one miss.
- "Lowest set" = the fewest reps among the working sets of that session.
- "Total reps" = sum of reps across the working sets of a session.

## 6. Gap and comeback

Applied when prescribing the **first session after a break**, to the last working weight. Days are counted from the last session of any kind.

| Days since last session | Adjustment | Reason code |
|---|---|---|
| 0–7 | None | — |
| 8–14 | Highest ladder step ≤ 0.95 × W | `GAP_5` |
| 15–28 | Highest ladder step ≤ 0.90 × W | `GAP_10` |
| More than 28 | Recalibrate (run the calibration procedure) | `RECAL` |

## 7. Stall rules

- **Stall** = row 5 of the decision table: the same working weight across 3 exposures, with total reps not higher than at the first of those exposures.
- **Counter resets** on any weight change, and after any break longer than 14 days.
- [ASSUMPTION — interpretation to confirm] "Total reps not higher than 3 exposures ago" is read as: compare the current session's total reps with the total at the **first** of the last three exposures at this weight.

## 8. Equipment jump handling

- A **jump** is any increase where the new working weight is more than 10% above the previous one. Jumps are flagged in the data as `JUMP`.
- The 10% threshold is a flag only. It does not block or change the increase.
- **First-exposure floor:** after any weight increase, the next session is a first exposure. A calibration session (including the ramp that starts a swap) is itself the first exposure (section 4, step 4; clarified in DECISIONS.md, C1). For that session only, the Miss threshold is **B − 2**:
  - Compound: 6 reps.
  - Isolation: 8 reps.
- The floor returns to B on the following session.

## 9. Pain rules (summary)

Full policy is in SAFETY.md. Core rule:

1. Pain reported on an exercise stops that exercise for the session.
2. Progression for that exercise freezes at its last working weight.
3. The next exposure uses the approved swap, starting with a ramp.
4. The original exercise returns after 2 pain-free sessions on the swap, as a first exposure.

## 10. In-session rules

- **No weight changes during a workout.**
- If a set falls below 6 reps, the user may end that exercise for the session. The engine runs after the session on the sets actually logged; the new weight is first used at the next session (clarified in DECISIONS.md, C6).

## 11. Constants

| Item | Value |
|---|---|
| Compound rest | 2–3 min |
| Isolation rest | 90 sec–2 min |
| Stall window | 3 exposures |
| Stall counter reset | Weight change, or break > 14 days |
| Fast-up window | 21 days from the exercise's first session |
| Deload factor (row 2, row 5) | 0.90 |
| Gap factors | 0.95 (8–14 days), 0.90 (15–28 days) |
| First-exposure floor | B − 2 |

## 12. Reason codes

| Code | Meaning |
|---|---|
| `PAIN_SWAP` | Pain reported; swap used next |
| `DELOAD_MISS` | Two or more misses; weight reduced |
| `FAST_UP` | Early fast increase (+2 steps) |
| `ADVANCE` | Top of range reached; +1 step |
| `STALL_DELOAD` | Stall detected; weight reduced |
| `HOLD_PUSH` | Same weight; push for more reps |
| `GAP_5` | Returning after 8–14 days |
| `GAP_10` | Returning after 15–28 days |
| `RECAL` | Returning after more than 28 days; recalibration |

The `JUMP` flag and the first-exposure flag are data fields, not reason codes.

## 13. Worked examples

Ladder for these examples: 6, 8, 10, 12, 14, 16, 18, 20 kg (dumbbells, per hand).

**Example A — Dumbbell bench press (compound, B 8, T 12), W = 16 kg**
- Sets: 12, 12, 12 (Good). Day 30 of this exercise.
- Row 3 fails (not Easy). Row 4 matches: lowest set (12) ≥ T.
- Result: **18 kg, target 8 reps, `ADVANCE`**. Next session is a first exposure (floor 6). Step 16 → 18 is +12.5%, which is a jump flag.

**Example B — Dumbbell lateral raise (isolation, B 10, T 15), W = 8 kg**
- Sets: 15, 15, 15 (Easy). Day 10 of this exercise.
- Row 3 matches: lowest set ≥ T, all Easy, within 21 days.
- Result: **12 kg (+2 steps), target 10 reps, `FAST_UP`**, jump flag (+50%). First-exposure floor 8.

**Example C — Dumbbell bench press, W = 16 kg, one miss**
- Sets: 9, 8, 7 (Good). Row 2 needs 2 misses; there is only one (7).
- Row 6: lowest set 7, so target = max(8, 7 + 1) = 8.
- Result: **16 kg (hold), target 8 reps, `HOLD_PUSH`.**

**Example D — Dumbbell bench press, W = 16 kg, two misses**
- Sets: 9, 7, 7 (Good). Two sets below 8.
- Row 2: highest ladder step ≤ 0.90 × 16 = 14.4 → **14 kg, target 8 reps, `DELOAD_MISS`.**
- Note: on this ladder, a 10% reduction becomes −12.5%. Ladder rounding makes deloads larger than the nominal percentage. Flagged in README.

**Example E — Gap**
- Last session 10 days ago, W = 16 kg.
- Highest ladder step ≤ 0.95 × 16 = 15.2 → **14 kg, `GAP_5`.** (Also −12.5% on this ladder.)

**Example F — Calibration**
- Ramp: 6 kg, 8 reps, Easy → 8 kg, 8 reps, Easy → 10 kg, 8 reps, Good.
- Result: **10 kg is working set 1.** Remaining working sets at 10 kg. Session is a first exposure.

**Example G — Calibration with Hard**
- Ramp: 6 kg Easy → 8 kg Easy → 10 kg Easy → 12 kg, 8 reps, Hard.
- Result: working weight is the previous step, **10 kg.**
