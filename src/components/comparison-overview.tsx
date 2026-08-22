"use client";

import ReactECharts from "echarts-for-react";
import type { Locale } from "@/lib/i18n";
import { message } from "@/lib/i18n";
import { getTeamColor } from "@/lib/team-colors";
import type { ComparisonSession, PaceChartData, StintSnapshot, Standing } from "@/lib/types";

const theme = { background: "#0a0c0f", surface: "#12161c", text: "#f5f7fa", muted: "#a6b0bf", line: "#29313d", cyan: "#39c6f4", red: "#ff3b30", amber: "#f4b740", green: "#3ddc97" };

type SummaryRow = Standing & { bestFinish: number | null; averageFinish: number | null; validSessions: number; medianPace: number | null; consistency: number | null; validLaps: number; paceGap: number | null };

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function deviation(values: number[], center: number | null) {
  if (!values.length || center === null) return null;
  return Math.sqrt(values.reduce((total, value) => total + (value - center) ** 2, 0) / values.length);
}

function formatNumber(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function resultPositions(sessions: ComparisonSession[], code: string) {
  return sessions.flatMap(session => {
    const result = session.results.find(item => item.code === code);
    return result?.status === "CLASSIFIED" && result.position !== undefined && Number.isFinite(result.position) ? [result.position] : [];
  });
}

function buildSummary(drivers: Standing[], sessions: ComparisonSession[], pace: PaceChartData) {
  const paceByCode = new Map(pace.series.map(series => [series.code, series]));
  const raw = drivers.map(driver => {
    const positions = resultPositions(sessions, driver.code);
    const paceValues = (paceByCode.get(driver.code)?.values ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const medianPace = median(paceValues);
    return { ...driver, bestFinish: positions.length ? Math.min(...positions) : null, averageFinish: positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : null, validSessions: positions.length, medianPace, consistency: deviation(paceValues, medianPace), validLaps: paceValues.length, paceGap: null };
  });
  const bestPace = raw.reduce<number | null>((best, row) => row.medianPace === null ? best : best === null ? row.medianPace : Math.min(best, row.medianPace), null);
  return raw.map(row => ({ ...row, paceGap: row.medianPace === null || bestPace === null ? null : row.medianPace - bestPace }));
}

function compoundColor(compound: string) {
  const value = compound.toLowerCase();
  if (value.includes("soft")) return theme.red;
  if (value.includes("medium")) return theme.amber;
  if (value.includes("hard")) return theme.text;
  if (value.includes("inter")) return theme.green;
  if (value.includes("wet")) return theme.cyan;
  return "#8d99a8";
}

function chartTooltipValue(value: unknown, suffix = "") {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : "—";
}

function DriverFieldChart({ rows, locale }: { rows: SummaryRow[]; locale: Locale }) {
  const sorted = [...rows].sort((a, b) => (b.points ?? Number.NEGATIVE_INFINITY) - (a.points ?? Number.NEGATIVE_INFINITY) || a.position - b.position);
  if (!sorted.length) return <div className="empty">No drivers selected for the overview.</div>;
  const option = {
    backgroundColor: "transparent",
    animation: false,
    aria: { enabled: true },
    grid: { left: 48, right: 28, top: 18, bottom: 32, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true, backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }, valueFormatter: (value: unknown) => chartTooltipValue(value, " pts") },
    xAxis: { type: "value", name: "POINTS", nameTextStyle: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }, axisLabel: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }, axisLine: { lineStyle: { color: theme.line } }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } },
    yAxis: { type: "category", inverse: true, data: sorted.map(row => row.code), axisLabel: { color: theme.text, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ name: message(locale, "comparisonPoints"), type: "bar", barMaxWidth: 18, data: sorted.map(row => ({ value: row.points ?? null, itemStyle: { color: getTeamColor(row.team, row.color), borderRadius: [0, 4, 4, 0] } })) }],
  };
  return <div className="chart-wrap overview-bar-chart" role="group" aria-label="Driver championship points ranking"><ReactECharts notMerge style={{ height: "100%", minHeight: 420 }} option={option} opts={{ renderer: "svg" }} /></div>;
}

function PositionHeatmap({ rows, sessions, locale }: { rows: SummaryRow[]; sessions: ComparisonSession[]; locale: Locale }) {
  if (!rows.length || !sessions.length) return <div className="empty">No completed session results are available for this filter.</div>;
  const labels = sessions.map(session => `${session.circuit}\n${session.sessionCode}`);
  const maxPosition = Math.max(1, ...sessions.flatMap(session => session.results.flatMap(result => result.status !== "CLASSIFIED" || result.position === undefined ? [] : [result.position])));
  const data = rows.flatMap((row, y) => sessions.flatMap((session, x) => {
    const position = session.results.find(result => result.code === row.code && result.status === "CLASSIFIED")?.position;
    return typeof position === "number" ? [[x, y, position]] : [];
  }));
  const option = {
    backgroundColor: "transparent",
    animation: false,
    aria: { enabled: true },
    grid: { left: 54, right: 32, top: 14, bottom: 78, containLabel: true },
    tooltip: { position: "top", confine: true, backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }, formatter: (params: unknown) => { if (!params || typeof params !== "object" || !("data" in params)) return ""; const value = (params as { data?: unknown }).data; if (!Array.isArray(value) || value.length < 3) return ""; return `${rows[value[1]]?.code ?? "—"}<br />${labels[value[0]]?.replace("\n", " · ") ?? "—"}<br /><b>P${value[2]}</b>`; } },
    xAxis: { type: "category", data: labels, splitArea: { show: true }, axisLabel: { color: theme.muted, fontSize: 9, fontFamily: "JetBrains Mono, monospace", interval: Math.max(0, Math.ceil(labels.length / 8) - 1), lineHeight: 13, hideOverlap: true }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } },
    yAxis: { type: "category", data: rows.map(row => row.code), splitArea: { show: true }, axisLabel: { color: theme.text, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } },
    visualMap: { min: 1, max: maxPosition, calculable: false, orient: "horizontal", left: "center", bottom: 8, text: ["BACK", "P1"], textStyle: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }, inRange: { color: [theme.green, theme.cyan, theme.amber, theme.red] } },
    series: [{ name: message(locale, "comparisonPosition"), type: "heatmap", data, label: { show: rows.length <= 12, color: theme.background, fontSize: 9, fontFamily: "JetBrains Mono, monospace", formatter: (params: unknown) => { if (!params || typeof params !== "object" || !("data" in params)) return ""; const value = (params as { data?: unknown }).data; return Array.isArray(value) ? `P${value[2]}` : ""; } }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "#000" } } }],
  };
  return <div className="chart-wrap comparison-heatmap" role="group" aria-label="Driver position heatmap by session"><ReactECharts notMerge style={{ height: "100%", minHeight: 440 }} option={option} opts={{ renderer: "svg" }} /></div>;
}

function PaceConsistencyChart({ rows }: { rows: SummaryRow[] }) {
  const points = rows.filter(row => row.medianPace !== null && row.consistency !== null).map(row => ({ value: [row.medianPace, row.consistency, row.validLaps], code: row.code, name: row.name, team: row.team, color: getTeamColor(row.team, row.color), itemStyle: { color: getTeamColor(row.team, row.color) } }));
  if (!points.length) return <div className="empty">No validated lap samples are available for this comparison.</div>;
  const option = {
    backgroundColor: "transparent",
    animation: false,
    aria: { enabled: true },
    grid: { left: 54, right: 28, top: 20, bottom: 46, containLabel: true },
    tooltip: { trigger: "item", confine: true, backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }, formatter: (params: unknown) => { if (!params || typeof params !== "object" || !("data" in params)) return ""; const item = (params as { data?: unknown }).data; if (!item || typeof item !== "object" || !("value" in item)) return ""; const data = (item as { value?: unknown }).value; const meta = item as { code?: string; name?: string; team?: string }; return `${meta.code ?? "—"} · ${meta.name ?? "—"}<br />Median pace: ${Array.isArray(data) ? chartTooltipValue(data[0], " s") : "—"}<br />Consistency: ${Array.isArray(data) ? chartTooltipValue(data[1], " s") : "—"}<br />Valid laps: ${Array.isArray(data) ? data[2] ?? "—" : "—"}`; } },
    xAxis: { type: "value", name: "MEDIAN PACE · SEC", nameTextStyle: { color: theme.muted, fontSize: 9, fontFamily: "JetBrains Mono, monospace" }, axisLabel: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace", formatter: (value: unknown) => chartTooltipValue(value) }, axisLine: { lineStyle: { color: theme.line } }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } },
    yAxis: { type: "value", name: "CONSISTENCY · STD DEV", nameTextStyle: { color: theme.muted, fontSize: 9, fontFamily: "JetBrains Mono, monospace" }, axisLabel: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace", formatter: (value: unknown) => chartTooltipValue(value) }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } },
    series: [{ name: "Drivers", type: "scatter", data: points, symbolSize: (value: unknown) => Array.isArray(value) && typeof value[2] === "number" ? Math.max(10, Math.min(28, 8 + Math.sqrt(value[2]) * 1.8)) : 12, itemStyle: { opacity: 0.88, borderColor: theme.background, borderWidth: 2 }, encode: { x: 0, y: 1 }, emphasis: { focus: "series", itemStyle: { borderColor: theme.text, borderWidth: 2 } } }],
  };
  return <div className="chart-wrap pace-consistency-chart" role="group" aria-label="Driver pace versus consistency scatter plot"><ReactECharts notMerge style={{ height: "100%", minHeight: 340 }} option={option} opts={{ renderer: "svg" }} /></div>;
}

function StrategyTimeline({ stints, activeDrivers }: { stints: StintSnapshot[]; activeDrivers: string[] }) {
  const rows = activeDrivers.map(code => ({ code, stints: stints.filter(stint => stint.code === code) })).filter(row => row.stints.length);
  if (!rows.length) return <div className="empty">FastF1 tyre strategy artifact is not available for the selected Driver(s) yet.</div>;
  const maxLap = Math.max(1, ...rows.flatMap(row => row.stints.map(stint => stint.endLap)));
  return <div className="stint-timeline" role="img" aria-label="Tyre stint timeline for selected drivers">{rows.map(row => <div className="stint-row" key={row.code}><span className="stint-driver">{row.code}</span><div className="stint-track">{row.stints.map(stint => <span key={`${row.code}-${stint.stint}`} className="stint-block" style={{ "--stint-left": `${stint.startLap / maxLap * 100}%`, "--stint-width": `${Math.max(2, (stint.endLap - stint.startLap + 1) / maxLap * 100)}%`, "--stint-color": compoundColor(stint.compound) } as React.CSSProperties} title={`${row.code} · ${stint.compound} · L${stint.startLap}–L${stint.endLap}`}>{stint.compound.slice(0, 3).toUpperCase()}</span>)}</div></div>)}</div>;
}

function TyrePerformanceChart({ stints, activeDrivers }: { stints: StintSnapshot[]; activeDrivers: string[] }) {
  const points = stints.filter(stint => activeDrivers.includes(stint.code) && stint.medianLap !== undefined);
  if (!points.length) return <div className="empty">Stint pace samples are not available yet.</div>;
  const option = { backgroundColor: "transparent", animation: false, aria: { enabled: true }, grid: { left: 54, right: 24, top: 20, bottom: 64, containLabel: true }, tooltip: { trigger: "axis", confine: true, padding: [10, 12], backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, borderWidth: 1, extraCssText: "box-shadow: 0 10px 28px rgba(0, 0, 0, 0.38); border-radius: 8px;", textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }, axisPointer: { type: "cross", lineStyle: { color: "#ffffff55", width: 1 }, crossStyle: { color: "#ffffff55" }, label: { backgroundColor: theme.cyan, color: theme.background, fontFamily: "JetBrains Mono, monospace" } }, valueFormatter: (value: unknown) => chartTooltipValue(value, " s") }, xAxis: { type: "category", data: points.map(point => `${point.code} S${point.stint}`), axisLabel: { color: theme.muted, fontSize: 9, fontFamily: "JetBrains Mono, monospace", rotate: 35, hideOverlap: true }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } }, yAxis: { type: "value", name: "STINT MEDIAN · SEC", nameTextStyle: { color: theme.muted, fontSize: 9, fontFamily: "JetBrains Mono, monospace" }, axisLabel: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } }, series: [{ name: "Stint pace", type: "line", data: points.map(point => ({ value: point.medianLap, itemStyle: { color: compoundColor(point.compound) } })), showSymbol: true, symbolSize: 8, connectNulls: false, lineStyle: { color: theme.cyan, width: 2 }, itemStyle: { borderColor: theme.background, borderWidth: 2 } }] };
  return <div className="chart-wrap tyre-performance-chart" role="group" aria-label="Tyre stint median pace chart"><ReactECharts notMerge style={{ height: "100%", minHeight: 300 }} option={option} opts={{ renderer: "svg" }} /></div>;
}

export function ComparisonOverview({ drivers, sessions, pace, stints, activeDrivers, locale }: { drivers: Standing[]; sessions: ComparisonSession[]; pace: PaceChartData; stints: StintSnapshot[]; activeDrivers: string[]; locale: Locale }) {
  const rows = buildSummary(drivers, sessions, pace);
  return <>
    <section className="comparison-overview-block">
      <div className="section-heading"><div><div className="eyebrow">FIELD OVERVIEW</div><h2>{message(locale, "comparisonDriverField")}</h2></div><p>{rows.length} DRIVERS · {sessions.length} SESSIONS</p></div>
      <div className="comparison-overview-grid"><article className="overview-card"><div className="chart-card-heading"><h3>Championship points</h3><span>JOLPICA · RESULTS</span></div><DriverFieldChart rows={rows} locale={locale} /></article><article className="overview-card"><div className="chart-card-heading"><h3>Pace vs consistency</h3><span>{pace.source === "FastF1" ? "FASTF1 · VALIDATED ARTIFACT" : "FASTF1 · PENDING"}</span></div><PaceConsistencyChart rows={rows} /></article></div>
      <details className="chart-table-details comparison-overview-table-wrap"><summary className="chart-table-toggle">OPEN DRIVER OVERVIEW TABLE</summary><div className="table-scroll"><table className="data-table comparison-overview-table"><thead><tr><th>Driver</th><th>Team</th><th>Points</th><th>Best finish</th><th>Avg finish</th><th>Valid sessions</th><th>Median pace</th><th>Consistency</th></tr></thead><tbody>{rows.map(row => <tr key={row.code}><td><b className="mono">{row.code}</b><br /><small>{row.name}</small></td><td>{row.team}</td><td className="mono">{row.points ?? "—"}</td><td className="mono">{row.bestFinish === null ? "—" : `P${row.bestFinish}`}</td><td className="mono">{formatNumber(row.averageFinish)}</td><td className="mono">{row.validSessions}</td><td className="mono">{row.medianPace === null ? "—" : `${formatNumber(row.medianPace, 3)} s`}</td><td className="mono">{row.consistency === null ? "—" : `${formatNumber(row.consistency, 3)} s`}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className="comparison-overview-block"><div className="section-heading"><div><div className="eyebrow">SEASON FORM</div><h2>{message(locale, "comparisonPositionHeatmap")}</h2></div><p>POSITION · LOWER IS BETTER</p></div><div className="overview-card"><div className="chart-context"><span>SESSION RESULTS · PROVISIONAL WHEN INCOMPLETE</span><span>{sessions.length} SESSIONS</span></div><PositionHeatmap rows={rows} sessions={sessions} locale={locale} /></div></section>
    <section className="comparison-deep-grid"><article className="overview-card"><div className="chart-card-heading"><div><div className="eyebrow">RACECRAFT</div><h3>{message(locale, "comparisonStrategy")}</h3></div><span>{stints.length ? "FASTF1 · VALIDATED ARTIFACT" : "FASTF1 · PENDING"}</span></div><StrategyTimeline stints={stints} activeDrivers={activeDrivers} /></article><article className="overview-card"><div className="chart-card-heading"><div><div className="eyebrow">TYRE PERFORMANCE</div><h3>{message(locale, "comparisonTyrePerformance")}</h3></div><span>{stints.length ? "FASTF1 · DEGRADATION" : "FASTF1 · PENDING"}</span></div><TyrePerformanceChart stints={stints} activeDrivers={activeDrivers} /></article></section>
    <section className="overview-card comparison-telemetry-card"><div className="chart-card-heading"><div><div className="eyebrow">ADVANCED DATA</div><h3>{message(locale, "comparisonTelemetry")}</h3></div><span>FASTF1 WORKER ARTIFACT</span></div><div className="telemetry-status"><span className="status-dot pending" aria-hidden="true" /><div><strong>{message(locale, "comparisonTelemetryUnavailable")}</strong><p>Validated speed, throttle, brake and gear traces appear here after the FastF1 worker publishes the session artifact. No OpenF1 values are substituted into analysis charts.</p></div></div></section>
  </>;
}
