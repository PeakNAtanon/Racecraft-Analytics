import { describe, expect, it } from "vitest";
import { finiteNumber } from "./number-utils";

describe("provider number normalization", () => {
  it("does not turn missing provider values into zero", () => {
    expect(finiteNumber(null)).toBeUndefined();
    expect(finiteNumber(undefined)).toBeUndefined();
    expect(finiteNumber(" ")).toBeUndefined();
  });

  it("preserves valid zero values", () => {
    expect(finiteNumber(0)).toBe(0);
    expect(finiteNumber("0")).toBe(0);
  });
});
