# Program catalog questions

Gaps found while turning PROGRAMS.md into the program catalog (`packages/catalog`, milestone M3). Each one has a test in `packages/catalog/test/integrity.test.ts`. Resolved items are recorded in `DECISIONS.md` (P1 to P4).

## PQ1. Swap-only exercises had no class or equipment (resolved 2026-10-08, DECISIONS P1)

Rohit supplied class and equipment for every swap-only exercise. They are listed in PROGRAMS.md §3a. "Overhead Triceps Extension" is named Overhead Cable Triceps Extension.

## PQ2. Two swaps were already in the same workout (resolved 2026-10-08, DECISIONS P2)

4-day Upper 2: Seated Cable Row now swaps to One-Arm Dumbbell Row. 4-day Lower 1: Leg Extension now swaps to Goblet Squat. A test checks that no swap duplicates an exercise in its own workout.

## PQ3. 45-Degree Back Extension is bodyweight (resolved 2026-10-08, DECISIONS P3)

Kept. Its ladder is added load: 0 kg is bodyweight only, then the loads the user's gym has. TESTING L-10 to L-13 cover it.

## PQ4. Assisted Pull-up ran backwards on the ladder (resolved 2026-10-08, DECISIONS P4)

Removed as a V1 swap and replaced by Machine Pulldown (compound, machine, 8–12) in both programs.

## PQ5. One-Arm Dumbbell Row class and equipment (open, raised 2026-10-08)

The new swap for Seated Cable Row has no stated class or equipment. The catalog uses compound, dumbbell (8–12 reps), inferred from its name and from the row it replaces, and PROGRAMS.md §3a marks it [ASSUMPTION]. **Needed:** confirm.

## Note: swap of a swap

PROGRAMS.md §5 says every V1 exercise has exactly one swap. Swap-only exercises still have none (README open item 12). The code default is in DECISIONS.md §2.

## Note: swaps are per program

Chest-Supported Row swaps to Seated Cable Row in the 3-day program but to Lat Pulldown in the 4-day program. Within one program every exercise has one swap, so the catalog stores the swap per program row (DATA_MODEL.md).
