import { describe, expect, it } from "vitest";
import { exercise } from "@liftly/catalog";
import { allProgramExercises, equipmentInUse, ladderProblem, mergeLadder, parseKg, rangeOf, STANDARD_LADDERS, withStandardLadders } from "../src/gym";

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

describe("standard gym weights", () => {
  it("every exercise in both programs gets a usable list with nothing saved", () => {
    for (const programId of ["3-day", "4-day"] as const) {
      const ladders = withStandardLadders(programId, {});
      for (const id of allProgramExercises(programId)) {
        const eq = exercise(id).equipment;
        if (eq === null) continue;
        expect(ladderProblem(ladders[id] ?? [], eq), id).toBeNull();
      }
    }
  });

  it("a saved list wins over the standard one", () => {
    const id = allProgramExercises("3-day")[0] ?? "";
    expect(withStandardLadders("3-day", { [id]: [10_000, 20_000] })[id]).toEqual([10_000, 20_000]);
  });

  it("standard lists are whole grams, sorted, and bodyweight starts at 0", () => {
    for (const list of Object.values(STANDARD_LADDERS)) expect([...list].sort((a, b) => a - b)).toEqual(list);
    expect(STANDARD_LADDERS.bodyweight[0]).toBe(0);
    expect(STANDARD_LADDERS.dumbbell.slice(0, 3)).toEqual([2_500, 5_000, 7_500]);
  });
});
