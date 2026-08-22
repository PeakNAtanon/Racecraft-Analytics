import { describe, expect, it } from "vitest";
import { buildPositionGapBridges, buildValueGapBridges } from "./position-series";

describe("buildPositionGapBridges", () => {
  it("creates a dashed bridge only across missing classified results", () => {
    expect(buildPositionGapBridges([2, null, null, 5, 3])).toEqual([[2, null, null, 5, null]]);
  });

  it("keeps adjacent results and incomplete data unbridged", () => {
    expect(buildPositionGapBridges([2, 4, 3])).toEqual([]);
    expect(buildPositionGapBridges([null, 4, null])).toEqual([]);
  });

  it("keeps separate gaps as separate bridges", () => {
    expect(buildPositionGapBridges([1, null, 3, null, 5])).toEqual([
      [1, null, 3, null, null],
      [null, null, 3, null, 5],
    ]);
  });
});


describe("buildValueGapBridges", () => {
  it("bridges only between finite values", () => {
    expect(buildValueGapBridges([1, null, undefined, 4, 5])).toEqual([[1, null, null, 4, null]]);
  });

  it("does not bridge leading, trailing, or complete gaps", () => {
    expect(buildValueGapBridges([null, 2, null])).toEqual([]);
    expect(buildValueGapBridges([null, undefined])).toEqual([]);
  });
});
