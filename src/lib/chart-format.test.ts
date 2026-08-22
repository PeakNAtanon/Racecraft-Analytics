import { describe, expect, it } from "vitest";
import { formatChartNumber, formatLapTooltipValue, formatPositionTooltipValue, toFiniteChartNumber } from "./chart-format";

describe("chart formatters", () => {
  it("normalizes finite numeric strings and rejects invalid values", () => {
    expect(toFiniteChartNumber("1.234")).toBe(1.234);
    expect(toFiniteChartNumber("")).toBeNull();
    expect(toFiniteChartNumber(undefined)).toBeNull();
    expect(toFiniteChartNumber("not-a-number")).toBeNull();
  });

  it("formats pace tooltip values without assuming a runtime number", () => {
    expect(formatLapTooltipValue("91.4567")).toBe("91.457 s");
    expect(formatLapTooltipValue(null)).toBe("—");
  });

  it("formats position tooltip and axis values safely", () => {
    expect(formatPositionTooltipValue(2)).toBe("P2");
    expect(formatPositionTooltipValue("not-a-number")).toBe("—");
    expect(formatChartNumber("3.8", 0)).toBe("4");
  });
});
