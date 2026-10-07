// Replay (DATA_MODEL.md section 4): a stored decision must be reproducible from its stored input.

import { decideNext } from "./decide";
import type { Decision } from "./types";

export interface ReplayResult {
  readonly matches: boolean;
  /** Field names whose replayed value differs from the stored one. */
  readonly differences: readonly string[];
}

const COMPARED: readonly (keyof Decision)[] = [
  "ruleRow",
  "reasonCode",
  "previousG",
  "nextG",
  "nextTargetReps",
  "nextIsFirstExposure",
  "jump",
  "ladderEdge",
  "missThresholdUsed",
  "stallCounter",
];

export function replayDecision(stored: Decision): ReplayResult {
  const again = decideNext(stored.input);
  if (again === null) return { matches: false, differences: ["decision"] };
  const differences = COMPARED.filter((k) => again[k] !== stored[k]).map(String);
  return { matches: differences.length === 0, differences };
}
