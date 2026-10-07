// Ladder maths (PROGRESSION_ENGINE.md section 3). Every result is a step that exists on the ladder,
// except when the rule asks for a step beyond the ladder's end, where W is kept and ladderEdge is set.

export interface LadderResult {
  readonly weightG: number;
  /** True when the ladder had no step where the rule wanted to go. */
  readonly ladderEdge: boolean;
}

/** Sorted, de-duplicated ladder. Throws on an empty ladder or a non-positive or non-integer load. */
export function normalizeLadder(ladderG: readonly number[]): number[] {
  if (ladderG.length === 0) throw new Error("Ladder is empty");
  for (const g of ladderG) {
    if (!Number.isInteger(g) || g <= 0) throw new Error(`Ladder load must be a positive integer of grams: ${g}`);
  }
  return [...new Set(ladderG)].sort((a, b) => a - b);
}

/** Converts kilograms to integer grams. Use at the edges of the app, never inside the rules. */
export function kgToG(kg: number): number {
  return Math.round(kg * 1000);
}

export function gToKg(g: number): number {
  return g / 1000;
}

/** Index of the highest step at or below w; -1 when every step is above w. */
function baseIndex(ladder: readonly number[], w: number): number {
  let idx = -1;
  for (let i = 0; i < ladder.length; i++) {
    if ((ladder.at(i) ?? Infinity) <= w) idx = i;
  }
  return idx;
}

/**
 * Moves n steps up from W. W off the ladder is treated as the highest step at or below it.
 * Past the top of the ladder, W is kept and ladderEdge is set (TESTING L-08, default).
 */
export function stepsUp(ladderG: readonly number[], w: number, n: number): LadderResult {
  const ladder = normalizeLadder(ladderG);
  const base = baseIndex(ladder, w);
  if (base === -1) {
    // W is below the whole ladder: the first step up is the lowest step.
    const target = ladder.at(Math.min(n - 1, ladder.length - 1));
    return { weightG: target ?? w, ladderEdge: n - 1 > ladder.length - 1 };
  }
  const want = base + n;
  if (want > ladder.length - 1) {
    const top = ladder.at(-1) ?? w;
    // Part of the move fits: take the highest step. None fits: keep W.
    return top > w ? { weightG: top, ladderEdge: true } : { weightG: w, ladderEdge: true };
  }
  return { weightG: ladder.at(want) ?? w, ladderEdge: false };
}

/**
 * Highest ladder step at or below (factor / 1000) x W, in integer maths.
 * No step that low: keep W if W is the lowest step, otherwise use the lowest step; set ladderEdge
 * (TESTING G-08, default).
 */
export function highestAtOrBelow(ladderG: readonly number[], w: number, factorPermille: number): LadderResult {
  const ladder = normalizeLadder(ladderG);
  let best: number | null = null;
  for (const step of ladder) {
    if (step * 1000 <= w * factorPermille) best = step;
  }
  if (best !== null) return { weightG: best, ladderEdge: false };
  const lowest = ladder.at(0) ?? w;
  return { weightG: Math.min(lowest, w), ladderEdge: true };
}

/** One step below a load; at the bottom of the ladder the load itself, with ladderEdge. */
export function previousStep(ladderG: readonly number[], w: number): LadderResult {
  const ladder = normalizeLadder(ladderG);
  let prev: number | null = null;
  for (const step of ladder) {
    if (step < w) prev = step;
  }
  return prev === null ? { weightG: w, ladderEdge: true } : { weightG: prev, ladderEdge: false };
}

export function isOnLadder(ladderG: readonly number[], w: number): boolean {
  return ladderG.includes(w);
}

/** JUMP flag: the new weight is more than 10% above the previous one (section 8). */
export function isJump(previousG: number, nextG: number, thresholdPermille: number): boolean {
  return nextG * 1000 > previousG * thresholdPermille;
}
