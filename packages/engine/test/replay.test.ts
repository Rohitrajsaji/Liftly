// DATA_MODEL.md section 4: every stored decision can be replayed from its stored input.
import { describe, expect, it } from "vitest";
import { decideNext, replayDecision, type Decision } from "../src";
import { input, kg, sets } from "./helpers";

describe("replay", () => {
  it("a stored decision, serialised and read back, replays to the same result", () => {
    const d = decideNext(input({ sets: sets([12, 12, 12]) }));
    if (d === null) throw new Error("no decision");
    const stored = JSON.parse(JSON.stringify(d)) as Decision;
    expect(replayDecision(stored)).toEqual({ matches: true, differences: [] });
  });
  it("a tampered record is reported with the fields that differ", () => {
    const d = decideNext(input({ sets: sets([12, 12, 12]) }));
    if (d === null) throw new Error("no decision");
    const tampered: Decision = { ...d, nextG: kg(20) };
    expect(replayDecision(tampered)).toEqual({ matches: false, differences: ["nextG"] });
  });
  it("no working sets and no pain -> no decision; the previous prescription stands", () => {
    expect(decideNext(input({ sets: [] }))).toBeNull();
  });
});
