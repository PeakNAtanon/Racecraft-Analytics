import { describe, expect, it } from "vitest";
import { canonicalSessionCode } from "./session-code";

describe("session provider mapping", () => {
  it("normalizes practice, sprint and race aliases to canonical codes", () => {
    expect(canonicalSessionCode("Practice 1")).toBe("FP1");
    expect(canonicalSessionCode("free   practice 2")).toBe("FP2");
    expect(canonicalSessionCode("Sprint Shootout")).toBe("SQ");
    expect(canonicalSessionCode("Sprint")).toBe("SPR");
    expect(canonicalSessionCode("Qualifying")).toBe("Q");
    expect(canonicalSessionCode("Race")).toBe("R");
  });

  it("returns undefined for provider rows that are not sessions", () => {
    expect(canonicalSessionCode("Day 1")).toBeUndefined();
    expect(canonicalSessionCode(undefined)).toBeUndefined();
  });
});
