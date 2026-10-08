# Liftly — Testing Specification

These scenarios test Progression Engine v1.0 and related rules. Each has inputs and expected outputs, written so they can be run by hand in Phase 0 and automated later.

**Conventions**
- Compound: B = 8, T = 12, unless stated. Isolation: B = 10, T = 15.
- Compound example ladder: 6, 8, 10, 12, 14, 16, 18, 20, 22 kg. Dumbbell ladder for isolation examples: 6, 8, 10, 12, 14, 16, 18, 20 kg.
- "Day N" means the Nth day since the exercise's first session.
- "First exposure" means the session right after a weight increase, or the calibration (ramp) session itself, including the ramp that starts a swap (DECISIONS.md, C1). The Miss floor is B − 2 for that session.

## 1. Decision table

| ID | Input (W, sets, effort, day, history) | Expected row | Next weight | Next target | Reason code |
|---|---|---|---|---|---|
| D-01 | W 16; 12, 12, 12; Good; day 30 | 4 | 18 | 8 | ADVANCE |
| D-02 | W 16; 12, 12, 12; Easy; day 10 | 3 | 20 | 8 | FAST_UP |
| D-03 | W 16; 12, 12, 12; Easy; day 40 | 4 | 18 | 8 | ADVANCE |
| D-04 | W 16; 14, 14, 14; Easy; day 40 | 3 (lowest ≥ T + 2) | 20 | 8 | FAST_UP |
| D-05 | W 16; 12, 12, 12; Hard; day 40 | 4 (any effort at top) | 18 | 8 | ADVANCE |
| D-06 | W 16; 10, 9, 9; Good; day 40 | 6 | 16 | 10 | HOLD_PUSH |
| D-07 | W 16; 9, 8, 7; Good; day 40 | 6 (one miss) | 16 | 8 | HOLD_PUSH |
| D-08 | W 16; 9, 7, 7; Good; day 40 | 2 (two misses) | 14 | 8 | DELOAD_MISS |
| D-09 | W 16; 12, 11, 7 (7 tapped Failed); day 40 | 6 (one set that is both below B and Failed counts as one miss) | 16 | 8 | HOLD_PUSH |
| D-10 | W 16; 12, 8 (tapped Failed), 7; day 40 | 2 (two misses: the Failed set and the set at 7) | 14 | 8 | DELOAD_MISS |
| D-11 | W 16; 8, 8, 8; Good; day 40 | 6 (no misses, lowest 8) | 16 | 9 | HOLD_PUSH |

## 2. Boundary tests

| ID | Input | Expected |
|---|---|---|
| B-01 | FAST_UP eligibility on day 21, all Easy, lowest 12 | Row 3 applies if day 21 is inside the window. [OPEN: confirm the boundary is inclusive] |
| B-02 | FAST_UP eligibility on day 22, all Easy, lowest 12 | Row 4: +1 step |
| B-03 | Lowest set exactly 12 (= T), all Easy, day 40 | Row 4 (not row 3), +1 step |
| B-04 | Lowest set exactly 8 (= B), no misses | Row 6: target 9 |
| B-05 | Lowest set exactly 7, no Failed tap | One miss, so row 6: target 8 |
| B-06 | Isolation: lowest set 10 (= B), day 40 | Row 6: target 11 |
| B-07 | Isolation: lowest set 15 (= T), all Easy, day 40 | Row 4: +1 step, target 10 |

## 3. Calibration

| ID | Input | Expected |
|---|---|---|
| C-01 | Ramp: 6 Easy, 8 Easy, 10 Good | Working weight 10. The 10 kg set counts as working set 1. |
| C-02 | Ramp: 6 Easy, 8 Easy, 10 Easy, 12 Hard | Working weight 10 (previous step). Ramp stops at Hard. |
| C-03 | Ramp: 6 Easy, 8 Easy, 10 Easy, 12 Failed | Working weight 10. |
| C-04 | Ramp: 6, 8, 10, 12, 14 all Easy (5 ramp sets) | Working weight 14 (the 5th Easy load). |
| C-05 | Ramp: 6 Good at first set | Working weight 6. Ramp stops immediately. |
| C-06 | Ramp sets logged | Logged as ramp. Not counted in volume. |
| C-07 | Return after 35 days, last working weight 20 kg | Ramp starts at or below 10 kg (50%). Decision type recalibration, reason code RECAL. |
| C-08 | Calibration session | Decision type = calibration. First exposure = yes. Miss floor = B − 2. |

## 4. Weight increase, hold, and deload

| ID | Input | Expected |
|---|---|---|
| W-01 | ADVANCE from 16 kg to 18 kg (+12.5%) | Jump flag set (over 10%). Next session is a first exposure with Miss floor 6. |
| W-02 | ADVANCE from 8 to 10 kg (+25%) | Jump flag set. Floor 6 (compound). |
| W-03 | Isolation lateral raise 8 → 10 kg (+25%) | Jump flag set. Floor 8 (isolation B − 2). |
| W-04 | First exposure after jump at 18 kg: sets 6, 7, 6 | No sets below 6, so 0 misses. Row 6: target = max(8, 6 + 1) = 8. Hold 18. |
| W-05 | First exposure after jump at 18 kg: sets 5, 5, 6 | Two misses (5 and 5 are below floor 6). Row 2: 0.90 × 18 = 16.2 → 16 kg, target 8. |
| W-06 | Hold after one miss: 9, 8, 7 (floor 8) | One miss (7). Row 6: hold, target 8. |
| W-07 | Deload: 9, 7, 7 at W 16 | Two misses. Row 2: highest step ≤ 14.4 → 14 kg. |
| W-08 | Set 2 at 5 reps mid-workout | Weight stays. Option to end the exercise for the session. No new weight until the next session. |

## 5. Stall

Interpretation used (PROGRESSION_ENGINE.md section 7): compare the current session's total reps with the total at the **first** of the last three exposures at this weight. [OPEN: confirm]

| ID | Totals at W 16 kg (oldest to newest, last 3 exposures) | Current session | Expected |
|---|---|---|---|
| S-01 | 31, 30, 31 | Current total 31, lowest set 9 | Stall: 31 is not higher than 31. Row 5: 14 kg, target 8, `STALL_DELOAD`. |
| S-02 | 30, 31, 32 | Current total 32, lowest set 9 | Not a stall (32 > 30). Row 6: hold 16, target 10, `HOLD_PUSH`. |
| S-03 | 30, 31, 31 | Current total 31, lowest set 9 | Not a stall (31 > 30). Row 6: `HOLD_PUSH`. |
| S-04 | 31, 30, 30 | Current total 30, lowest set 10 | Stall: 30 ≤ 31. Row 5: 14 kg, `STALL_DELOAD`. |
| S-05 | Weight changed in the last session | — | Counter reset. No stall. |
| S-06 | Break of 20 days before the current session | — | Counter reset. No stall. |

## 6. Break and comeback

| ID | Days since last session | Last W | Expected |
|---|---|---|---|
| G-01 | 7 | 16 | No adjustment. Prescribe 16. |
| G-02 | 8 | 16 | `GAP_5`: highest step ≤ 15.2 → 14 kg. This is −12.5% on a 2 kg ladder (see finding below). |
| G-03 | 14 | 16 | `GAP_5`: 14 kg. |
| G-04 | 15 | 16 | `GAP_10`: highest step ≤ 14.4 → 14 kg. |
| G-05 | 28 | 16 | `GAP_10`: 14 kg. |
| G-06 | 29 | 16 | `RECAL`. Ramp from 8 kg or below (50% of 16 kg). |
| G-07 | 10 days, currently on a pain swap | Swap W 14 | The gap rule applies to the swap's weight. |
| G-08 | 10 days, W is already the bottom of the ladder (6 kg) | 6 | No lower step exists. Keep 6 kg. [ASSUMPTION: behaviour at the bottom of the ladder] |

**Finding — ladder rounding:** on a 2 kg ladder, the 0.90 and 0.95 factors can cut more than the stated percentage (16 → 14 kg is −12.5%). This follows v1.0 as written, but it is a finding to review in Phase 0.

## 7. Pain

| ID | Input | Expected |
|---|---|---|
| P-01 | Pain on set 2 of dumbbell bench press, severity 3, no other flags | Exercise stops for the session. Row 1, `PAIN_SWAP`. Progression frozen at W. Next exposure: machine chest press, ramp. |
| P-02 | User taps effort "Hard" for a burning muscle, no pain tap | Recorded as effort, not pain. Normal rows apply. |
| P-03 | Pain at severity 4 | Professional-help screen. Exercise removed from prescriptions. |
| P-04 | Pain at night | Professional-help screen. |
| P-05 | Pain still present 24+ hours later | Professional-help screen. |
| P-06 | Numbness | Professional-help screen. |
| P-07 | Second pain report on the same exercise within 4 weeks | Swap made permanent. Professional-help screen shown and the original exercise removed from prescriptions (a second report is itself a condition in SAFETY.md section 3; DECISIONS.md, C3). |
| P-08 | Returning to the original exercise | Only after 2 consecutive pain-free sessions on the swap. Returns as a first exposure at the frozen weight. |
| P-09 | Pain on the swap exercise | Row 1 applies to the swap. [ASSUMPTION: swap-of-swap behaviour, not defined in v1.0] |
| P-10 | Pain reported on exercise A; exercise B has no pain | Only exercise A is affected. |

## 8. Large equipment increments

| ID | Input | Expected |
|---|---|---|
| L-01 | Dumbbell bench 16 → 18 kg (+12.5%), jump flag | First exposure, floor 6. Sets 7, 6, 6: no misses. Row 6: target max(8, 6 + 1) = 8. |
| L-02 | Dumbbell bench 8 → 10 kg (+25%), jump flag | First exposure, floor 6. Sets 6, 6, 5: one miss (5). Row 6, target 8. |
| L-03 | Dumbbell bench 8 → 10 kg, sets 5, 5, 5 | Three misses. Row 2: 0.90 × 10 = 9.0, highest step ≤ 9.0 on the dumbbell ladder → 8 kg, target 8. (Corrected 2026-10-08, ENGINE_QUESTIONS.md Q1.) |
| L-04 | Isolation lateral raise 8 → 10 kg (+25%), floor 8 | Sets 9, 8, 8: no misses. Row 6, target 10. |
| L-05 | Isolation lateral raise 8 → 10 kg, sets 9, 7, 7 | Two misses (7 is below floor 8). Row 2: 0.90 × 10 = 9.0, highest step ≤ 9.0 on the dumbbell ladder → 8 kg. (Corrected 2026-10-08, ENGINE_QUESTIONS.md Q1.) |
| L-06 | Machine with 5 kg steps: 40 → 45 kg (+12.5%) | Jump flag set. No finer step available, so 45 kg is taken with floor 6. |
| L-07 | Ladder missing an intermediate step | Engine uses the next available step only. Never computes an off-ladder weight. |
| L-08 | Requested step doesn't exist (top of the ladder) | Keep W. [ASSUMPTION: log code for this case; not defined in v1.0] |
| L-09 | Deload from 10 kg on a 2.5 kg ladder (5, 7.5, 10 kg) | 0.90 × 10 = 9.0. Highest step ≤ 9.0 → 7.5 kg. The result depends on the exercise's real ladder, never a computed 9 kg. |

## 9. Reason codes

| ID | Check |
|---|---|
| R-01 | Every target shown has exactly one reason code from the v1.0 list, except a first-time calibration (R-02). When a gap applies, the gap code (`GAP_5`, `GAP_10`, `RECAL`) is that target's code (DECISIONS.md, C5). |
| R-02 | A first-time calibration (new exercise or swap) has decision type calibration and no reason code. A recalibration after more than 28 days has code `RECAL` (DECISIONS.md, C5). |
| R-03 | The debrief references only codes that appear in the engine output. |
| R-04 | `JUMP` and `first_exposure` appear as flags, not codes. |

## 10. Debrief validation (AI_COACH.md)

| ID | Input | Expected |
|---|---|---|
| A-01 | Valid structured output | Shown. |
| A-02 | Output mentions a weight not in the input | Rejected. Fallback shown. |
| A-03 | Output uses a reason code not in the input | Rejected. Fallback shown. |
| A-04 | Output contains diagnostic language (for example, naming an injury) | Rejected. Fallback shown. |
| A-05 | Output over the length limit | Rejected. Fallback shown. |
| A-06 | Claude unavailable | Session saved. Targets shown. Fallback text shown. Retry once later. |

## 11. Offline and persistence

| ID | Scenario | Expected |
|---|---|---|
| O-01 | Log a set with no connection | Stored locally. Visible in the session. |
| O-02 | Close the app mid-workout, reopen | Session and sets restored. |
| O-03 | Reconnect after an offline session | Synced with no duplicates. [ASSUMPTION: conflict behaviour] |

## 12. Test execution

- **Phase 0:** run the scenarios by hand against the paper or spreadsheet version of the engine.
- **Later:** each scenario becomes an automated test, with the expected outputs as fixed fixtures.
- **Any failing scenario is a spec question, not a code fix.** Record it and review it against v1.0.
