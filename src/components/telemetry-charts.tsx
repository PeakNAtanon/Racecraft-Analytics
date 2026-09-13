"use client";

import { useId, useState } from "react";
import { analysisText as text } from "@/lib/analysis-copy";
import { distanceTelemetry, elapsedTelemetry } from "@/lib/telemetry-chart";
import { LazyECharts } from "@/components/lazy-echarts";
import type { Locale } from "@/lib/i18n";
import type { DriverTelemetrySnapshot } from "@/lib/types";

export function TelemetryCharts({ traces, locale }: { traces: Array<{ code: string; color: string; telemetry: DriverTelemetrySnapshot }>; locale: Locale }) {
  const [tableOpen, setTableOpen] = useState(false);
  const [preferredAxis, setPreferredAxis] = useState<"distance" | "time">("distance");
  const hintId = useId();
  const distanceReady = traces.length > 0 && traces.every(trace => trace.telemetry.available && distanceTelemetry(trace.telemetry.samples).length > 0);
  const axis = distanceReady ? preferredAxis : "time";
  const axisLabel = text(locale, axis === "distance" ? "FastF1 distance (m)" : "Elapsed time (s)");
  const plotted = traces.filter(trace => trace.telemetry.available).map(trace => ({ ...trace, samples: axis === "distance"
    ? distanceTelemetry(trace.telemetry.samples).map(sample => ({ ...sample, x: sample.distance }))
    : elapsedTelemetry(trace.telemetry.samples).map(sample => ({ ...sample, x: sample.elapsed })) }));
  const fields = ["speed", "throttle", "brake", "gear"] as const;
  const labels = [text(locale, "Speed"), text(locale, "Throttle"), text(locale, "Brake"), text(locale, "Gear")];
  const coordinates = plotted.flatMap(trace => trace.samples.map(sample => sample.x));
  const minimum = Math.min(0, ...coordinates);
  const maximum = Math.max(...coordinates, 1);
  const option = {
    animation: false, aria: { enabled: true },
    textStyle: { fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "system-ui, sans-serif" },
    legend: { top: 0, textStyle: { color: "#c3cbd5" }, data: plotted.map(trace => trace.code) },
    tooltip: { trigger: "axis", confine: true, renderMode: "richText" },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid: fields.map((_, index) => ({ left: 60, right: 20, top: 50 + index * 115, height: 70 })),
    xAxis: fields.map((_, index) => ({ type: "value", gridIndex: index, min: minimum, max: maximum, axisLabel: { show: index === 3, color: "#c3cbd5" }, name: index === 3 ? axisLabel : "", nameTextStyle: { color: "#c3cbd5" }, nameLocation: "middle", nameGap: 28, axisPointer: { show: true }, splitLine: { show: false } })),
    yAxis: fields.map((field, index) => ({ type: "value", gridIndex: index, name: `${labels[index]}${field === "speed" ? " · km/h" : field === "throttle" ? " · %" : ""}`, nameTextStyle: { color: "#c3cbd5" }, min: 0, ...(field === "speed" ? {} : { max: field === "throttle" ? 100 : field === "brake" ? 1 : 8, interval: field === "brake" ? 1 : undefined }), axisLabel: { color: "#c3cbd5", ...(field === "brake" ? { formatter: (value: number) => text(locale, value === 1 ? "On" : "Off") } : {}) }, splitLine: { lineStyle: { color: "#29313d" } } })),
    dataZoom: [{ type: "inside", xAxisIndex: [0, 1, 2, 3], filterMode: "none", zoomOnMouseWheel: "ctrl" }, { type: "slider", xAxisIndex: [0, 1, 2, 3], bottom: 0, height: 22, filterMode: "none", textStyle: { color: "#c3cbd5" } }],
    series: fields.flatMap((field, index) => plotted.map(trace => ({ name: trace.code, type: "line", xAxisIndex: index, yAxisIndex: index, showSymbol: false, connectNulls: false, step: field === "gear" || field === "brake" ? "end" : false, lineStyle: { color: trace.color, width: 2 }, itemStyle: { color: trace.color }, data: trace.samples.map(sample => [sample.x, typeof sample[field] === "number" && Number.isFinite(sample[field]) ? sample[field] : null]) }))),
  };
  return <div className="telemetry-detail">
    <div className="telemetry-axis-controls" role="group" aria-label={text(locale, "Telemetry axis")}>
      <button type="button" className="button" aria-pressed={axis === "distance"} disabled={!distanceReady} aria-describedby={!distanceReady ? hintId : undefined} onClick={() => setPreferredAxis("distance")}>{text(locale, "Distance (m)")}</button>
      <button type="button" className="button" aria-pressed={axis === "time"} onClick={() => setPreferredAxis("time")}>{text(locale, "Time (s)")}</button>
    </div>
    {!distanceReady && <p id={hintId} role="status">{text(locale, "Distance is unavailable or incomplete for one or more selected drivers. Use time; older artifacts need a worker refresh.")}</p>}
    <p>{text(locale, axis === "distance" ? "Drag to zoom all traces together. Distance uses FastF1's computed lap-distance channel, not exact GPS position. No distance is calculated in the browser." : "Drag to zoom all traces together. Times start at the first recorded sample of each lap.")}</p>
    {coordinates.length ? <>
      <LazyECharts key={axis} notMerge option={option} style={{ height: 550, width: "100%" }} opts={{ renderer: "svg" }} />
      <details className="chart-table-details" onToggle={event => setTableOpen(event.currentTarget.open)}><summary className="chart-table-toggle">{text(locale, "OPEN DATA TABLE")}</summary>{tableOpen && <div className="table-scroll" tabIndex={0} role="region" aria-label={text(locale, "Telemetry trace")}><table className="data-table"><thead><tr><th>{axisLabel}</th><th>{text(locale, "Source")}</th>{labels.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{plotted.flatMap(trace => trace.samples.map((sample, index) => <tr key={`${trace.code}-${index}`}><td>{sample.x.toFixed(3)}</td><td>{trace.code}</td>{fields.map(field => <td key={field}>{sample[field] ?? "—"}</td>)}</tr>))}</tbody></table></div>}</details>
    </> : <p className="empty">{text(locale, "Telemetry needs valid timestamps to align the traces. No sample-index approximation is shown.")}</p>}
  </div>;
}
