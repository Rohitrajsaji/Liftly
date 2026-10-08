# Program catalog questions

Gaps found while turning PROGRAMS.md into the program catalog (`packages/catalog`, milestone M3). Each one has a test in `packages/catalog/test/integrity.test.ts` that lists the affected exercises, so it stays visible until it is closed. None of them blocks the engine. They block prescribing the affected swaps in the app (M6 to M8).

## PQ1. Swap-only exercises have no class or equipment (open, raised 2026-10-08)

PROGRAMS.md gives class and equipment only for exercises in a program row. Twelve exercises appear only as swaps. The class matters because it sets the rep range (8–12 or 10–15).

- Stated elsewhere in the spec, so filled in: Dumbbell Bench Press (compound, dumbbell; TESTING P-01, L-01) and Dumbbell Lateral Raise (isolation, dumbbell; TESTING B-07, L-04).
- Not stated anywhere, so left empty: Assisted Pull-up, Lying Leg Curl, Overhead Triceps Extension, Incline Machine Press, Cable Bicep Curl, Machine Shoulder Press, Cable Crossover, Leg Press Calf Raise, Machine Glute Kickback, Cable Crunch.

**Needed:** class and equipment for those 10. PROGRAMS.md §5 also says every V1 exercise has exactly one swap; the swap-only exercises have none, which is the same gap as README open item 12 (swap of a swap).

## PQ2. Two swaps are already in the same workout (open)

- **Upper 2:** Seated Cable Row swaps to Chest-Supported Row, which is exercise 3 in Upper 2.
- **Lower 1:** Leg Extension swaps to Leg Press, which is exercise 1 in Lower 1.

After pain on the first exercise, the user would do the swap exercise twice in one session. **Needed:** confirm that's intended, or name a different swap for these two rows.

## PQ3. 45-Degree Back Extension is bodyweight (open)

The engine moves weight along a load ladder. A bodyweight exercise has no ladder, so the engine can't increase, hold or deload it as written. **Needed:** how it progresses (for example, a ladder of held plate weights starting at 0 kg, or reps only).

## PQ4. Assisted Pull-up runs backwards on the ladder (open)

On an assisted machine, a higher setting means more help, so getting stronger means moving down the ladder. Every engine rule assumes up is harder. **Needed:** confirm the swap, or how its ladder is recorded (for example, as body weight minus assistance).

## Note: swaps are per program

Chest-Supported Row swaps to Seated Cable Row in the 3-day program but to Lat Pulldown in the 4-day program; Leg Extension swaps to Goblet Squat (3-day) and Leg Press (4-day). Within one program every exercise has one swap, so the catalog stores the swap per program row. DATA_MODEL.md was updated to say so.
