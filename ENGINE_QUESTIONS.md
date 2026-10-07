# Engine spec questions

Per TESTING.md §12, a failing scenario is a spec question, not a code fix. Each question below has a red test that stays red until the spec owner decides. The expected values in the tests are copied from TESTING.md and are not edited to make the code pass.

## Q1. Deload after a jump: which weight does 0.90 × W use? (open, raised 2026-10-07)

**Failing tests:** L-03, L-05.

**Conflict.** PROGRESSION_ENGINE.md §5 row 2 says the deload is "highest ladder step ≤ 0.90 × W", with W = the last working weight. In L-03 and L-05 the user just moved 8 → 10 kg and lifted 10 kg, so W = 10 and 0.90 × 10 = 9 → **8 kg**. TESTING.md expects "highest step ≤ 7.2 → **6 kg**", which is 0.90 × 8, the weight *before* the jump.

W-05 uses the other reading: after a 16 → 18 kg jump, it expects 0.90 × 18 = 16.2 → **16 kg** (the weight just lifted). The engine follows §5 and W-05, so L-03 and L-05 fail.

| Test | Weight lifted | Engine (0.90 × weight lifted) | TESTING.md expects |
|---|---|---|---|
| W-05 | 18 kg (after 16 → 18) | 16 kg | 16 kg (passes) |
| L-03 | 10 kg (after 8 → 10) | 8 kg | 6 kg |
| L-05 | 10 kg (after 8 → 10) | 8 kg | 6 kg |

**Options.**
1. **Recommended:** keep §5 as written (W = weight just lifted) and correct L-03 and L-05 to expect 8 kg ("highest step ≤ 9.0 → 8 kg"). No engine change.
2. Change the rule so a deload on a first exposure after an increase is calculated from the pre-increase weight. That is a rule change, needs a new numbered engine version, and would also change W-05's expected value (0.90 × 16 = 14.4 → 14 kg).
