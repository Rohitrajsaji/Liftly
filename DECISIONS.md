# Liftly — Decisions

Decisions that close contradictions between the spec documents, and the defaults the code uses for items that are still open. Progression Engine v1.0 rules are unchanged; entries here only clarify how conflicting statements are read.

Architecture plan (approved 2026-10-07): https://claude.ai/code/artifact/2123b995-f957-49d9-99cf-1100086aad6a

## 1. Resolved contradictions (approved by Rohit, 2026-10-07)

| # | Topic | Decision | Docs updated |
|---|---|---|---|
| C1 | First exposure after calibration | The calibration (ramp) session itself is the first exposure, including the ramp that starts a swap. Its working sets use the Miss floor B − 2. The following session uses floor B unless the weight was increased. | README terminology, PROGRESSION_ENGINE §8, TESTING conventions |
| C2 | Ladder scope | One ladder per exercise per gym, created from an equipment-type template. | DATA_MODEL |
| C3 | Second pain report within 4 weeks | Swap becomes permanent, the professional-help screen shows, and the original exercise is removed from prescriptions (SAFETY §3 applies as written). | TESTING P-07 |
| C4 | Claude and pain wording | Claude may name `PAIN_SWAP` and say the exercise changes next session. All pain and swap wording is fixed text (SAFETY §5) rendered by the app outside Claude's text. | AI_COACH §1, §5 |
| C5 | One reason code per target | Each prescription has one reason code. When a gap applies, the gap code (`GAP_5`, `GAP_10`, `RECAL`) is the code. A first-time calibration has decision type calibration and no code. | TESTING R-01, R-02; DATA_MODEL |
| C6 | "Decision happens at the next session" | The engine runs after the session on the sets actually logged. The new weight is first used at the next session. | PROGRESSION_ENGINE §10 |
| C7 | First save without an account, offline | The in-progress workout stays on the device, unsynced, and attaches to the account when sign-in succeeds. Nothing is uploaded before the account exists. | PRD AC-2 |
| C8 | Calibration flag | Calibration is recorded per exercise (decision type, ramp sets). The session flag is derived. | DATA_MODEL |

## 2. Defaults used by the code for open items (not decided)

These are not decisions. Each is a named constant or a single function in `packages/engine/src/assumptions.ts`, and the tests that depend on it are tagged so they can be listed. Changing one is a one-line change plus a test update.

| Open item | Default in code | Source |
|---|---|---|
| Fast-up window boundary | Day 21 is inside the window (inclusive) | README #4, TESTING B-01 |
| Stall interpretation | Compare current total reps with the first of the last three exposures at this weight | README #3, ENGINE §7 |
| Bottom of the ladder | No step at or below the target: keep W if W is the lowest step, otherwise use the lowest step; set a `ladder_edge` data flag | README #6, TESTING G-08 |
| Top of the ladder | No higher step: keep W, set a `ladder_edge` data flag; the reason code is still the row's code | README #6, TESTING L-08 |
| Swap of a swap | Row 1 applies to the swap exercise; the original stays frozen | README #12, TESTING P-09 |
| Partial exercise | The table runs on the working sets logged; sets not done are not misses | Architecture plan, gaps |
| Gap applied to a pending increase | Gap factor applies to the last working weight, as ENGINE §6 says | Architecture plan, gaps |
| Gap session target reps | B | Architecture plan, gaps |
| Gap cut and first exposure | A gap cut is not a first exposure (ENGINE §8 lists increases only) | Architecture plan, gaps |
| Calibration start | Lowest ladder step; for `RECAL`, highest step ≤ 50% of W | Architecture plan, gaps |
| Hard or Failed when no lower ladder step exists | That step becomes the working weight (`ladder_edge` flag) | Architecture plan, gaps |
| 5th ramp set still Easy | That load is the working weight; the 5th set stays a ramp set and does not count as working set 1 | ENGINE §4 (only a Good set is stated to count) |
| Serious pain and the swap | The swap takes the removed exercise's slot, starting with a ramp | Architecture plan, gaps |
| Stall counter on first exposure | A first exposure at a new weight starts the window at 1 | ENGINE §7 (counter resets on weight change) |
