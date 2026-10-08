# Liftly — Data Model

Conceptual only. No database technology has been selected.

**Naming:** this document uses **user** for the product. The Phase 0 spreadsheet uses **tester**; these map one-to-one (`tester_id` → `user_id`).

Field names are conceptual. Types and formats are chosen during architecture.

## 1. Entities

### User
| Field | Notes |
|---|---|
| user_id | Pseudonymous identifier. Used in place of name for analytics and AI input |
| months_training | At onboarding |
| program | 3-day or 4-day |
| start_date | YYYY-MM-DD |
| injury_notes | Optional free text. Sensitive; see SAFETY.md |
| consent | Record of consent, with date |
| last_session_date | YYYY-MM-DD, derived |

### Gym
| Field | Notes |
|---|---|
| gym_id | |
| user_id | Owner |
| name | Optional label |

### Equipment and load ladder
| Field | Notes |
|---|---|
| ladder_id | |
| gym_id | |
| exercise_id | One ladder per exercise per gym (DECISIONS.md, C2). Created from an equipment-type template, then edited |
| equipment_type | barbell, dumbbell, machine, cable |
| load_definition | total (barbell), per hand (dumbbell), displayed value (machine/cable), added load (bodyweight exercises; a 0 kg step is bodyweight only) |
| loads_kg | Ordered list of available loads in kg |

### Exercise
| Field | Notes |
|---|---|
| exercise_id | |
| name | Exact name, used consistently |
| type | compound or isolation |
| rep_bottom | 8 (compound) or 10 (isolation) |
| rep_top | 12 (compound) or 15 (isolation) |
| ladder_id | Gym-specific |
| swap_id | Approved alternative: one per exercise within a program, from PROGRAMS.md. The same exercise can have a different swap in the other program (PROGRAMS_QUESTIONS.md) |
| first_session_date | Set on first logged session |

### Program and workout slot
| Field | Notes |
|---|---|
| program_id | 3-day or 4-day |
| slot_key | A, B, C (3-day) or U1, L1, U2, L2 (4-day) |
| slot_order | 1, 2, 3 … (sequence, not weekday) |
| exercise_id | |
| target_sets | As listed in the program |

Programs and slots are fixed by the frozen spec. They are reference data, not user data.

### Session
| Field | Notes |
|---|---|
| session_id | |
| user_id | |
| date | YYYY-MM-DD |
| slot_key | Which workout in the sequence |
| started_at, ended_at | Timestamps |
| completion | full or partial |
| days_since_last | Derived at prescription time |
| user_note | Optional |
| is_calibration | Y/N, derived: Y if any exercise in the session was calibrated. Calibration is recorded per exercise on its decision (decision_type) and sets (set_type ramp) (DECISIONS.md, C8) |

### Set
| Field | Notes |
|---|---|
| set_id | |
| session_id | |
| exercise_id | |
| set_no | |
| set_type | ramp or working |
| target_kg, target_reps | As prescribed |
| actual_kg, actual_reps | As performed |
| effort | Easy, Good, Hard, Failed |
| miss | Y/N (below bottom, or Failed). Derived. First-exposure floor applied |
| skipped | Y/N |

### Pain flag
| Field | Notes |
|---|---|
| pain_id | |
| session_id | |
| exercise_id | |
| set_no | |
| location | Free text or fixed choice |
| severity | 0–10 |
| at_rest_or_night | Y/N |
| present_after_24h | Y/N |
| numbness_tingling_swelling_instability | Y/N |
| triggered_screen | Y/N (professional-help screen shown) |
| pain_free_confirmed | Recorded on swap sessions |

### Progression decision
| Field | Notes |
|---|---|
| decision_id | |
| session_id | |
| exercise_id | |
| decision_type | normal, calibration, gap, pain, recalibration |
| rule_row | 1–6 from the decision table |
| reason_code | PAIN_SWAP, DELOAD_MISS, FAST_UP, ADVANCE, STALL_DELOAD, HOLD_PUSH, GAP_5, GAP_10, RECAL. One per prescription; the gap code wins when a gap applies; empty for a first-time calibration (DECISIONS.md, C5) |
| previous_kg | |
| next_kg | |
| next_target_reps | |
| first_exposure | Y/N |
| jump_flag | Y/N |
| miss_threshold_used | B or B − 2 |
| gap_adjustment | None, GAP_5, GAP_10, RECAL |
| stall_counter | Integer |
| engine_version | e.g. v1.0 |

### Override
| Field | Notes |
|---|---|
| override_id | |
| decision_id | The engine decision being overridden |
| user_action | What was done instead |
| reason | Free text |
| recorded_by | user or operator |

### Claude debrief
| Field | Notes |
|---|---|
| debrief_id | |
| session_id | |
| input_snapshot | The structured input sent to Claude (pseudonymous) |
| output_text | Validated debrief, or fallback text |
| source | claude or fallback |
| validation_result | Passed, or reason for failure |
| created_at | Timestamp |
| user_rating | 1–5, optional |

### Feedback
| Field | Notes |
|---|---|
| feedback_id | |
| user_id | |
| text | Free text |
| created_at | |

## 2. Relationships

```
User 1─* Gym 1─* Ladder (one per exercise used at that gym)
User 1─* Session
Session 1─* Set
Session 1─* Progression decision
Session 1─* Pain flag
Session 1─0..1 Claude debrief
Progression decision 0..1─* Override
Exercise *─1 Ladder (per gym)
Exercise *─0..1 Exercise (swap)
Program 1─* Program slot *─1 Exercise
```

## 3. Derived values (computed, not typed in)

- **Miss:** actual reps below the bottom of the range, or effort is Failed.
- **Days since last session:** calculated at prescription time from session dates.
- **Total reps** and **lowest set:** per session, per exercise.
- **Stall:** from the last 3 exposures at the same weight.
- **Jump flag:** new weight more than 10% above previous weight.

## 4. Required data for every decision

Every decision must be reproducible from stored data. A decision record must hold the inputs used (the sets, the days since last session, the ladder, and the engine version). This allows the Phase 0 data to be replayed against revised rules.
