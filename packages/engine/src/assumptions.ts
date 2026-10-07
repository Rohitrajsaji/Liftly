// Defaults for items the spec leaves open. Each is listed in DECISIONS.md section 2.
// These are not decisions: change them here when Rohit rules, then update the tagged tests.
// Defaults that are a whole behaviour rather than a switch live in their function, marked "(default)":
// ladder edges in ladder.ts, gap target reps in prescribe.ts, swap-of-swap in pain.ts.

/** README #4, TESTING B-01: day 21 counts as inside the fast-up window. */
export const FAST_UP_WINDOW_INCLUSIVE = true;

/** DECISIONS.md: a weight cut by the gap rule is not a first exposure (ENGINE section 8 lists increases only). */
export const GAP_CUT_IS_FIRST_EXPOSURE = false;

/** DECISIONS.md: when the 5th ramp set is still Easy, that set does not count as working set 1. */
export const FIFTH_EASY_RAMP_COUNTS_AS_WORKING = false;

/** DECISIONS.md: after a serious-pain condition removes an exercise, its swap takes the slot. */
export const SERIOUS_PAIN_SWAP_TAKES_SLOT = true;
