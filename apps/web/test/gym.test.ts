import { describe, expect, it } from "vitest";
import { allProgramExercises, equipmentInUse, ladderProblem, mergeLadder, parseKg, rangeOf } from "../src/gym";

describe("gym ladders", () => {
  it("parses kilograms", () => {
    expect(parseKg("12.5")).toBe(12500);
    expect(parseKg("12,5")).toBe(12500);
    expect(parseKg("0")).toBe(0);
    expect(parseKg("abc")).toBeNull();
    expect(parseKg("-3")).toBeNull();
    expect(parseKg("401")).toBeNull();
  });
  it("builds a range with the user's own step", () => {
    expect(rangeOf(5000, 20000, 5000)).toEqual([5000, 10000, 15000, 20000]);
    expect(rangeOf(2500, 10000, 2500)).toEqual([2500, 5000, 7500, 10000]);
    expect(rangeOf(10000, 5000, 5000)).toBeNull();
    expect(rangeOf(0, 1_000_000, 1)).toBeNull();
  });
  it("merges without repeats, sorted", () => {
    expect(mergeLadder([10000, 5000], [5000, 7500])).toEqual([5000, 7500, 10000]);
  });
  it("needs two steps, and allows 0 only for bodyweight", () => {
    expect(ladderProblem([5000], "machine")).toBe("too_few");
    expect(ladderProblem([0, 5000], "machine")).toBe("zero_not_allowed");
    expect(ladderProblem([0, 5000], "bodyweight")).toBeNull();
    expect(ladderProblem([5000, 10000], "cable")).toBeNull();
  });
  it("covers every kind of equipment and exercise (swaps included) a program uses", () => {
    expect(equipmentInUse("3-day")).toEqual(["machine", "cable", "dumbbell"]);
    expect(equipmentInUse("4-day")).toContain("bodyweight");
    expect(allProgramExercises("4-day").length).toBeGreaterThan(15);
  });
});
