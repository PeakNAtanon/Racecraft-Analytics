import { describe, expect, it } from "vitest";
import { durationLabel, gapLabel } from "./session-result-format";

describe("OpenF1 session result formatting", () => {
  it("keeps null provider values unavailable instead of converting them to zero", () => {
    expect(gapLabel(null)).toBe("—");
    expect(durationLabel(null)).toBe("—");
  });

  it("uses the last non-zero qualifying gap instead of joining phase placeholders", () => {
    expect(gapLabel([1.208, 0, 0])).toBe("+1.208 s");
    expect(gapLabel([0, 0, 0])).toBe("LEADER");
  });

  it("uses the latest available qualifying duration", () => {
    expect(durationLabel([75.321, 74.987, 74.654])).toBe("1:14.654");
    expect(durationLabel([75.321, null, null])).toBe("1:15.321");
  });
});
