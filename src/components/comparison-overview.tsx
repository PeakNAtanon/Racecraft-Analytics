"use client";

import { analysisText as text } from "@/lib/analysis-copy";
import { LazyECharts } from "@/components/lazy-echarts";
import { TelemetryCharts } from "@/components/telemetry-charts";
import { AnalysisDataState } from "@/components/analysis-data-state";
import type { Locale } from "@/lib/i18n";
import { message } from "@/lib/i18n";
import { getTeamColor } from "@/lib/team-colors";
import type { ComparisonSession, DriverTelemetrySnapshot, PaceChartData, StintSnapshot, Standing } from "@/lib/types";

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
  if (!sorted.length) return <div className="empty">{text(locale, "No drivers selected for the overview.")}</div>;
  const option = {
    backgroundColor: "transparent",
    animation: false,
    aria: { enabled: true },
    grid: { left: 48, right: 28, top: 18, bottom: 32, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true, backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, textStyle: { color: theme.text, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace", fontSize: 11 }, valueFormatter: (value: unknown) => chartTooltipValue(value, " pts") },
    xAxis: { type: "value", name: text(locale, "POINTS"), nameTextStyle: { color: theme.muted, fontSize: 10, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" }, axisLabel: { color: theme.muted, fontSize: 10, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" }, axisLine: { lineStyle: { color: theme.line } }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } },
    yAxis: { type: "category", inverse: true, data: sorted.map(row => row.code), axisLabel: { color: theme.text, fontSize: 11, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ name: message(locale, "comparisonPoints"), type: "bar", barMaxWidth: 18, data: sorted.map(row => ({ value: row.points ?? null, itemStyle: { color: getTeamColor(row.team, row.color), borderRadius: [0, 4, 4, 0] } })) }],
  };
  return <div className="chart-wrap overview-bar-chart" role="group" aria-label="Driver championship points ranking"><LazyECharts notMerge style={{ height: "100%", minHeight: 420 }} option={option} opts={{ renderer: "svg" }} /></div>;
}

function PositionHeatmap({ rows, sessions, locale }: { rows: SummaryRow[]; sessions: ComparisonSession[]; locale: Locale }) {
  if (!rows.length || !sessions.length) return <div className="empty">{text(locale, "No completed session results are available for this filter.")}</div>;
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
    tooltip: { position: "top", confine: true, backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, textStyle: { color: theme.text, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace", fontSize: 11 }, formatter: (params: unknown) => { if (!params || typeof params !== "object" || !("data" in params)) return ""; const value = (params as { data?: unknown }).data; if (!Array.isArray(value) || value.length < 3) return ""; return `${rows[value[1]]?.code ?? "—"}<br />${labels[value[0]]?.replace("\n", " · ") ?? "—"}<br /><b>P${value[2]}</b>`; } },
    xAxis: { type: "category", data: labels, splitArea: { show: true }, axisLabel: { color: theme.muted, fontSize: 9, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace", interval: Math.max(0, Math.ceil(labels.length / 8) - 1), lineHeight: 13, hideOverlap: true }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } },
    yAxis: { type: "category", data: rows.map(row => row.code), splitArea: { show: true }, axisLabel: { color: theme.text, fontSize: 10, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } },
    visualMap: { min: 1, max: maxPosition, calculable: false, orient: "horizontal", left: "center", bottom: 8, text: [text(locale, "BACK"), "P1"], textStyle: { color: theme.muted, fontSize: 10, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" }, inRange: { color: [theme.green, theme.cyan, theme.amber, theme.red] } },
    series: [{ name: message(locale, "comparisonPosition"), type: "heatmap", data, label: { show: rows.length <= 12, color: theme.background, fontSize: 9, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace", formatter: (params: unknown) => { if (!params || typeof params !== "object" || !("data" in params)) return ""; const value = (params as { data?: unknown }).data; return Array.isArray(value) ? `P${value[2]}` : ""; } }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "#000" } } }],
  };
  return <div className="chart-wrap comparison-heatmap" role="group" aria-label="Driver position heatmap by session"><LazyECharts notMerge style={{ height: "100%", minHeight: 440 }} option={option} opts={{ renderer: "svg" }} /></div>;
}

function PaceConsistencyChart({ rows, locale }: { rows: SummaryRow[]; locale: Locale }) {
  const points = rows.filter(row => row.medianPace !== null && row.consistency !== null).map(row => ({ value: [row.medianPace, row.consistency, row.validLaps], code: row.code, name: row.name, team: row.team, color: getTeamColor(row.team, row.color), itemStyle: { color: getTeamColor(row.team, row.color) } }));
  if (!points.length) return <div className="empty">{text(locale, "No validated lap samples are available for this comparison.")}</div>;
  const option = {
    backgroundColor: "transparent",
    animation: false,
    aria: { enabled: true },
    grid: { left: 54, right: 28, top: 20, bottom: 46, containLabel: true },
    tooltip: { trigger: "item", confine: true, backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, textStyle: { color: theme.text, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace", fontSize: 11 }, formatter: (params: unknown) => { if (!params || typeof params !== "object" || !("data" in params)) return ""; const item = (params as { data?: unknown }).data; if (!item || typeof item !== "object" || !("value" in item)) return ""; const data = (item as { value?: unknown }).value; const meta = item as { code?: string; name?: string; team?: string }; return `${meta.code ?? "—"} · ${meta.name ?? "—"}<br />Median pace: ${Array.isArray(data) ? chartTooltipValue(data[0], " s") : "—"}<br />Consistency: ${Array.isArray(data) ? chartTooltipValue(data[1], " s") : "—"}<br />Valid laps: ${Array.isArray(data) ? data[2] ?? "—" : "—"}`; } },
    xAxis: { type: "value", name: text(locale, "MEDIAN PACE · SEC"), nameTextStyle: { color: theme.muted, fontSize: 9, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" }, axisLabel: { color: theme.muted, fontSize: 10, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace", formatter: (value: unknown) => chartTooltipValue(value) }, axisLine: { lineStyle: { color: theme.line } }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } },
    yAxis: { type: "value", name: text(locale, "CONSISTENCY · STD DEV"), nameTextStyle: { color: theme.muted, fontSize: 9, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" }, axisLabel: { color: theme.muted, fontSize: 10, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace", formatter: (value: unknown) => chartTooltipValue(value) }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } },
    series: [{ name: text(locale, "Drivers"), type: "scatter", data: points, symbolSize: (value: unknown) => Array.isArray(value) && typeof value[2] === "number" ? Math.max(10, Math.min(28, 8 + Math.sqrt(value[2]) * 1.8)) : 12, itemStyle: { opacity: 0.88, borderColor: theme.background, borderWidth: 2 }, encode: { x: 0, y: 1 }, emphasis: { focus: "series", itemStyle: { borderColor: theme.text, borderWidth: 2 } } }],
  };
  return <div className="chart-wrap pace-consistency-chart" role="group" aria-label="Driver pace versus consistency scatter plot"><LazyECharts notMerge style={{ height: "100%", minHeight: 340 }} option={option} opts={{ renderer: "svg" }} /></div>;
}

function StrategyTimeline({ stints, activeDrivers, locale }: { stints: StintSnapshot[]; activeDrivers: string[]; locale: Locale }) {
  const rows = activeDrivers.map(code => ({ code, stints: stints.filter(stint => stint.code === code) })).filter(row => row.stints.length);
  if (!rows.length) return <div className="empty">{text(locale, "FastF1 tyre strategy artifact is not available for the selected Driver(s) yet.")}</div>;
  const maxLap = Math.max(1, ...rows.flatMap(row => row.stints.map(stint => stint.endLap)));
  return <div className="stint-timeline" role="img" aria-label="Tyre stint timeline for selected drivers">{rows.map(row => <div className="stint-row" key={row.code}><span className="stint-driver">{row.code}</span><div className="stint-track">{row.stints.map(stint => <span key={`${row.code}-${stint.stint}`} className="stint-block" style={{ "--stint-left": `${stint.startLap / maxLap * 100}%`, "--stint-width": `${Math.max(2, (stint.endLap - stint.startLap + 1) / maxLap * 100)}%`, "--stint-color": compoundColor(stint.compound) } as React.CSSProperties} title={`${row.code} · ${stint.compound} · L${stint.startLap}–L${stint.endLap}`}>{stint.compound.slice(0, 3).toUpperCase()}</span>)}</div></div>)}</div>;
}

function TyrePerformanceChart({ stints, activeDrivers, locale }: { stints: StintSnapshot[]; activeDrivers: string[]; locale: Locale }) {
  const points = stints.filter(stint => activeDrivers.includes(stint.code) && stint.medianLap !== undefined);
  if (!points.length) return <div className="empty">{text(locale, "Stint pace samples are not available yet.")}</div>;
  const option = { backgroundColor: "transparent", animation: false, aria: { enabled: true }, grid: { left: 54, right: 24, top: 20, bottom: 64, containLabel: true }, tooltip: { trigger: "axis", confine: true, padding: [10, 12], backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, borderWidth: 1, extraCssText: "box-shadow: 0 10px 28px rgba(0, 0, 0, 0.38); border-radius: 8px;", textStyle: { color: theme.text, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace", fontSize: 11 }, axisPointer: { type: "cross", lineStyle: { color: "#ffffff55", width: 1 }, crossStyle: { color: "#ffffff55" }, label: { backgroundColor: theme.cyan, color: theme.background, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" } }, valueFormatter: (value: unknown) => chartTooltipValue(value, " s") }, xAxis: { type: "category", data: points.map(point => `${point.code} S${point.stint}`), axisLabel: { color: theme.muted, fontSize: 9, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace", rotate: 35, hideOverlap: true }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } }, yAxis: { type: "value", name: text(locale, "STINT MEDIAN · SEC"), nameTextStyle: { color: theme.muted, fontSize: 9, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" }, axisLabel: { color: theme.muted, fontSize: 10, fontFamily: locale === "th" ? "Noto Sans Thai, sans-serif" : "JetBrains Mono, monospace" }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } }, series: [{ name: text(locale, "Stint pace"), type: "line", data: points.map(point => ({ value: point.medianLap, itemStyle: { color: compoundColor(point.compound) } })), showSymbol: true, symbolSize: 8, connectNulls: false, lineStyle: { color: theme.cyan, width: 2 }, itemStyle: { borderColor: theme.background, borderWidth: 2 } }] };
  return <div className="chart-wrap tyre-performance-chart" role="group" aria-label="Tyre stint median pace chart"><LazyECharts notMerge style={{ height: "100%", minHeight: 300 }} option={option} opts={{ renderer: "svg" }} /></div>;
}

function TelemetryComparisonChart({ drivers, activeDrivers, telemetryByDriver, locale }: { drivers: Standing[]; activeDrivers: string[]; telemetryByDriver?: Record<string, DriverTelemetrySnapshot>; locale: Locale }) {
  const traces = activeDrivers.map(code => {
    const telemetry = telemetryByDriver?.[code] ?? { available: false, source: "FastF1" as const, sampleCount: 0, fields: [], samples: [] };
    const driver = drivers.find(item => item.code === code);
    return { code, telemetry, color: getTeamColor(driver?.team, driver?.color) };
  });
  if (!traces.some(trace => trace.telemetry.available)) return <AnalysisDataState state={telemetryByDriver ? "partial" : "processing"} locale={locale} />;
  return <TelemetryCharts traces={traces} locale={locale} />;
}

export function ComparisonOverview({ drivers, sessions, pace, stints, telemetryByDriver, activeDrivers, locale }: { drivers: Standing[]; sessions: ComparisonSession[]; pace: PaceChartData; stints: StintSnapshot[]; telemetryByDriver?: Record<string, DriverTelemetrySnapshot>; activeDrivers: string[]; locale: Locale }) {
  const rows = buildSummary(drivers, sessions, pace);
  return <>
    <section className="comparison-overview-block">
      <div className="section-heading"><div><div className="eyebrow">FIELD OVERVIEW</div><h2>{message(locale, "comparisonDriverField")}</h2></div><p>{rows.length} {text(locale, "DRIVERS ·")} {sessions.length} {text(locale, "SESSIONS")}</p></div>
      <div className="comparison-overview-grid"><article className="overview-card"><div className="chart-card-heading"><h3>{text(locale, "Championship points")}</h3><span>JOLPICA · RESULTS</span></div><DriverFieldChart rows={rows} locale={locale} /></article><article className="overview-card"><div className="chart-card-heading"><h3>{text(locale, "Pace vs consistency")}</h3><span>{pace.source === "FastF1" ? text(locale, "FASTF1 · VALIDATED ARTIFACT") : text(locale, "FASTF1 · PENDING")}</span></div><PaceConsistencyChart rows={rows} locale={locale} /></article></div>
      <details className="chart-table-details comparison-overview-table-wrap"><summary className="chart-table-toggle">{text(locale, "OPEN DRIVER OVERVIEW TABLE")}</summary><div className="table-scroll"><table className="data-table comparison-overview-table"><thead><tr><th>{text(locale, "Driver")}</th><th>{text(locale, "Team")}</th><th>{text(locale, "Points")}</th><th>{text(locale, "Best finish")}</th><th>{text(locale, "Avg finish")}</th><th>{text(locale, "Valid sessions")}</th><th>{text(locale, "Median pace")}</th><th>{text(locale, "Consistency")}</th></tr></thead><tbody>{rows.map(row => <tr key={row.code}><td><b className="mono">{row.code}</b><br /><small>{row.name}</small></td><td>{row.team}</td><td className="mono">{row.points ?? "—"}</td><td className="mono">{row.bestFinish === null ? "—" : `P${row.bestFinish}`}</td><td className="mono">{formatNumber(row.averageFinish)}</td><td className="mono">{row.validSessions}</td><td className="mono">{row.medianPace === null ? "—" : `${formatNumber(row.medianPace, 3)} s`}</td><td className="mono">{row.consistency === null ? "—" : `${formatNumber(row.consistency, 3)} s`}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className="comparison-overview-block"><div className="section-heading"><div><div className="eyebrow">{text(locale, "SEASON FORM")}</div><h2>{message(locale, "comparisonPositionHeatmap")}</h2></div><p>{text(locale, "POSITION · LOWER IS BETTER")}</p></div><div className="overview-card"><div className="chart-context"><span>{text(locale, "SESSION RESULTS · PROVISIONAL WHEN INCOMPLETE")}</span><span>{sessions.length} {text(locale, "SESSIONS")}</span></div><PositionHeatmap rows={rows} sessions={sessions} locale={locale} /></div></section>
    <section className="comparison-deep-grid"><article className="overview-card"><div className="chart-card-heading"><div><div className="eyebrow">{text(locale, "RACECRAFT")}</div><h3>{message(locale, "comparisonStrategy")}</h3></div><span>{stints.length ? text(locale, "FASTF1 · VALIDATED ARTIFACT") : text(locale, "FASTF1 · PENDING")}</span></div><StrategyTimeline stints={stints} activeDrivers={activeDrivers} locale={locale} /></article><article className="overview-card"><div className="chart-card-heading"><div><div className="eyebrow">{text(locale, "TYRE PERFORMANCE")}</div><h3>{message(locale, "comparisonTyrePerformance")}</h3></div><span>{stints.length ? "FASTF1 · DEGRADATION" : text(locale, "FASTF1 · PENDING")}</span></div><TyrePerformanceChart stints={stints} activeDrivers={activeDrivers} locale={locale} /></article></section>
    <section className="overview-card comparison-telemetry-card"><div className="chart-card-heading"><div><div className="eyebrow">{text(locale, "ADVANCED DATA")}</div><h3>{message(locale, "comparisonTelemetry")}</h3></div><span>{telemetryByDriver ? "FASTF1 · SPEED TRACE" : "FASTF1 WORKER ARTIFACT"}</span></div><TelemetryComparisonChart drivers={drivers} activeDrivers={activeDrivers} telemetryByDriver={telemetryByDriver} locale={locale} /></section>
  </>;
}
