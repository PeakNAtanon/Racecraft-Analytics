import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { DriverTelemetryPoint } from "@/lib/types";

type ChartProps = { option: { xAxis: Array<{ name: string }>; series: Array<{ data: number[][] }>; dataZoom: Array<{ xAxisIndex: number[] }> } };
const chart = vi.hoisted(() => vi.fn<(props: ChartProps) => null>(() => null));
vi.mock("@/components/lazy-echarts", () => ({ LazyECharts: (props: ChartProps) => { chart(props); return null; } }));
import { TelemetryCharts } from "./telemetry-charts";
import { ComparisonOverview } from "./comparison-overview";

beforeEach(() => chart.mockClear());
const trace = (code: string, samples: DriverTelemetryPoint[]) => ({ code, color: "#ffffff", telemetry: { available: true, source: "FastF1" as const, sampleCount: samples.length, fields: ["speed", "distance"], samples } });
const complete = [{ timestamp: "00:00:00", distance: 12.5, speed: 100 }, { timestamp: "00:00:02", distance: 112, speed: 200 }];

it("defaults to distance and links all four panels using original metre coordinates", () => {
  const html = renderToStaticMarkup(createElement(TelemetryCharts, { locale: "th", traces: [trace("VER", complete)] }));
  expect(html).toContain('aria-pressed="true">ระยะทาง (เมตร)');
  expect(html).not.toContain("disabled");
  const option = chart.mock.calls[0][0].option;
  expect(option.series[0].data).toEqual([[12.5, 100], [112, 200]]);
  expect(option.series).toHaveLength(4);
  expect(option.xAxis[3].name).toContain("เมตร");
  expect(option.dataZoom.every(zoom => zoom.xAxisIndex.join() === "0,1,2,3")).toBe(true);
});

it("disables distance for a mixed old/new comparison and keeps both time traces", () => {
  const old = complete.map(({ timestamp, speed }) => ({ timestamp, speed }));
  const html = renderToStaticMarkup(createElement(TelemetryCharts, { locale: "en", traces: [trace("VER", complete), trace("HAM", old)] }));
  expect(html).toContain('disabled=""');
  expect(html).toContain('aria-pressed="true">Time (s)');
  expect(html).toContain("older artifacts need a worker refresh");
  const option = chart.mock.calls[0][0].option;
  expect(option.series).toHaveLength(8);
  expect(option.series[0].data).toEqual([[0, 100], [2, 200]]);
  expect(option.series[1].data).toEqual([[0, 100], [2, 200]]);
});

it("does not hide a driver's missing distance by dropping that driver", () => {
  const html = renderToStaticMarkup(createElement(TelemetryCharts, { locale: "en", traces: [trace("VER", complete), trace("HAM", [complete[0], { timestamp: "00:00:01", speed: 120 }, complete[1]])] }));
  expect(html).toContain('disabled=""');
  expect(html).toContain("Distance is unavailable or incomplete");
});

it("can use distance without requiring timestamps or manufacturing a time axis", () => {
  const html = renderToStaticMarkup(createElement(TelemetryCharts, { locale: "en", traces: [trace("VER", [{ distance: 0, speed: 100 }, { distance: 20, speed: 120 }])] }));
  expect(html).toContain('aria-pressed="true">Distance (m)');
  expect(chart).toHaveBeenCalled();
});

it("keeps a missing selected driver in Compare's distance availability check", () => {
  const html = renderToStaticMarkup(createElement(ComparisonOverview, { locale: "en", drivers: [], sessions: [], pace: { source: "FastF1", sessionLabel: "Test", laps: [], series: [] }, stints: [], activeDrivers: ["VER", "HAM"], telemetryByDriver: { VER: trace("VER", complete).telemetry } }));
  expect(html).toContain('disabled=""');
  expect(html).toContain('aria-pressed="true">Time (s)');
});
