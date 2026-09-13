import { describe, expect, it } from "vitest";
import { distanceTelemetry, elapsedTelemetry } from "./telemetry-chart";

describe("telemetry distance alignment", () => {
  it("preserves FastF1's original metre values, including a small negative edge", () => {
    const samples = [{ distance: -0.2, speed: 100 }, { distance: 42.5 }, { distance: 200, brake: 0 }];
    expect(distanceTelemetry(samples)).toEqual(samples);
  });
  it.each([
    [], [{ distance: 1 }], [{ speed: 100 }, { speed: 200 }],
    [{ distance: 0 }, {}, { distance: 10 }],
    [{ distance: 0 }, { distance: Number.NaN }],
    [{ distance: 0 }, { distance: Number.POSITIVE_INFINITY }],
    [{ distance: 10 }, { distance: 5 }, { distance: 20 }],
    [{ distance: 1 }, { distance: 1 }],
  ])("rejects a missing or unusable distance axis: %j", (...samples) => {
    expect(distanceTelemetry(samples)).toEqual([]);
  });
  it("allows stationary samples without reordering or rescaling the lap", () => {
    expect(distanceTelemetry([{ distance: 0 }, { distance: 0 }, { distance: 100 }]).map(sample => sample.distance)).toEqual([0, 0, 100]);
  });
});

describe("telemetry time alignment", () => {
  it("uses recorded time spacing rather than sample index", () => {
    const result = elapsedTelemetry([{ timestamp: "2026-03-08 12:00:00.000", speed: 100 }, { timestamp: "2026-03-08 12:00:00.250", speed: 120 }, { timestamp: "2026-03-08 12:00:02.000", speed: 200 }]);
    expect(result.map(sample => sample.elapsed)).toEqual([0, 0.25, 2]);
  });
  it("supports FastF1 timedelta timestamps and preserves missing channels", () => {
    expect(elapsedTelemetry([{ timestamp: "0 days 00:01:00", brake: 0 }, { timestamp: "0 days 00:01:01.500", brake: 1 }])).toEqual([
      { timestamp: "0 days 00:01:00", brake: 0, elapsed: 0 }, { timestamp: "0 days 00:01:01.500", brake: 1, elapsed: 1.5 },
    ]);
  });
  it("does not invent a time axis for missing or invalid timestamps", () => {
    expect(elapsedTelemetry([{ speed: 100 }, { timestamp: "invalid", speed: 200 }])).toEqual([]);
  });
  it("rejects backward samples without changing the origin", () => {
    expect(elapsedTelemetry([{ timestamp: "00:00:02" }, { timestamp: "00:00:01" }, { timestamp: "00:00:03" }]).map(sample => sample.elapsed)).toEqual([0, 1]);
  });
});
