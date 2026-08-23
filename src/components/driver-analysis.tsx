"use client";

import Link from "next/link";
import ReactECharts from "echarts-for-react";
import { useMemo, useState } from "react";
import { PaceChart } from "@/components/pace-chart";
import { getTeamColor, getTeamMark } from "@/lib/team-colors";
import { formatAverageFinish } from "@/lib/driver-analysis";
import type { DriverAnalysisSession, DriverAnalysisSnapshot, DriverTelemetrySnapshot } from "@/lib/types";
import type { Locale } from "@/lib/i18n";

const theme = { background: "#0a0c0f", surface: "#12161c", text: "#f5f7fa", muted: "#a6b0bf", line: "#29313d", cyan: "#39c6f4", red: "#ff3b30", amber: "#f4b740", green: "#3ddc97" };

function fastF1Seconds(value: number | undefined) {
  return value === undefined || !Number.isFinite(value) ? "—" : `${value.toFixed(3)} s`;
}

function completedSessions(sessions: DriverAnalysisSession[]) {
  return sessions.filter((session) => session.status === "complete" && session.resultStatus === "CLASSIFIED" && session.position !== undefined);
}

function compactSessionLabel(session: DriverAnalysisSession) {
  const round = session.round > 0 ? `R${String(session.round).padStart(2, "0")}` : session.circuit;
  return `${round}\n${session.sessionCode}`;
}

function tooltipDataIndex(params: unknown) {
  const first = Array.isArray(params) ? params[0] : params;
  return typeof first === "object" && first !== null && "dataIndex" in first && typeof first.dataIndex === "number" ? first.dataIndex : -1;
}

function FormChart({ sessions }: { sessions: DriverAnalysisSession[] }) {
  const rows = completedSessions(sessions).filter((session) => session.sessionCode === "R" || session.sessionCode === "SPR");
  if (!rows.length) return <div className="empty">No completed Race or Sprint results are available for this driver.</div>;
  const option = {
    backgroundColor: "transparent", animation: false, aria: { enabled: true },
    tooltip: { trigger: "axis", confine: true, padding: [10, 12], backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }, axisPointer: { type: "cross", lineStyle: { color: "#ffffff55", width: 1 }, crossStyle: { color: "#ffffff55" }, label: { backgroundColor: theme.cyan, color: theme.background, fontFamily: "JetBrains Mono, monospace" } }, formatter: (params: unknown) => { const session = rows[tooltipDataIndex(params)]; return session ? `<b>${session.circuit} · ${session.sessionCode}</b><br/>Finish: <b>P${session.position}</b>` : "—"; } },
    grid: { left: 54, right: 22, top: 30, bottom: 58, containLabel: true },
    xAxis: { type: "category", data: rows.map(compactSessionLabel), axisLabel: { color: theme.text, fontSize: 10, fontFamily: "JetBrains Mono, monospace", interval: "auto", hideOverlap: true, rotate: 0, lineHeight: 13 }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } },
    yAxis: { type: "value", inverse: true, min: 1, axisLabel: { color: theme.text, fontSize: 10, fontFamily: "JetBrains Mono, monospace", formatter: (item: unknown) => `P${item}` }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } },
    series: [{ name: "Finish position", type: "line", data: rows.map((session) => session.position), smooth: 0.18, connectNulls: false, showSymbol: true, symbolSize: 8, lineStyle: { color: theme.cyan, width: 2.5 }, itemStyle: { color: theme.cyan, borderColor: theme.background, borderWidth: 2 }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${theme.cyan}25` }, { offset: 1, color: "#00000000" }] } } }],
  };
  return <><div className="chart-wrap driver-form-chart" role="group" aria-label="Driver race finish trend"><ReactECharts notMerge style={{ height: "100%", minHeight: 280 }} option={option} opts={{ renderer: "svg" }} /></div><details className="chart-table-details"><summary className="chart-table-toggle">OPEN RACE FORM TABLE</summary><div className="table-scroll" role="region" aria-label="Race finish data table" tabIndex={0}><table className="data-table chart-data-table"><thead><tr><th>Circuit</th><th>Session</th><th>Finish</th><th>Source</th></tr></thead><tbody>{rows.map((item) => <tr key={item.sessionKey}><td>{item.circuit}</td><td>{item.sessionCode}</td><td className="mono">P{item.position}</td><td className="mono">{item.source}</td></tr>)}</tbody></table></div></details></>;
}

function PointsMomentumChart({ sessions }: { sessions: DriverAnalysisSession[] }) {
  const rows = sessions.filter((session) => session.status === "complete" && (session.sessionCode === "R" || session.sessionCode === "SPR") && session.points !== undefined).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (!rows.length) return <div className="empty">Championship points are not available for the completed scoring sessions yet.</div>;
  const totals = rows.map((_, index) => rows.slice(0, index + 1).reduce((total, session) => total + (session.points ?? 0), 0));
  const option = {
    backgroundColor: "transparent", animation: false, aria: { enabled: true },
    tooltip: { trigger: "axis", confine: true, backgroundColor: `${theme.surface}f7`, borderColor: `${theme.green}66`, textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }, axisPointer: { type: "cross", lineStyle: { color: "#ffffff55", width: 1 }, crossStyle: { color: "#ffffff55" }, label: { backgroundColor: theme.green, color: theme.background, fontFamily: "JetBrains Mono, monospace" } }, formatter: (params: unknown) => { const index = tooltipDataIndex(params); const session = rows[index]; return session ? `<b>${session.circuit} · ${session.sessionCode}</b><br/>Event: ${session.points} pts<br/>Season total: <b>${totals[index]} pts</b>` : "—"; } },
    grid: { left: 54, right: 22, top: 30, bottom: 58, containLabel: true },
    xAxis: { type: "category", data: rows.map(compactSessionLabel), axisLabel: { color: theme.text, fontSize: 10, fontFamily: "JetBrains Mono, monospace", interval: "auto", hideOverlap: true, rotate: 0, lineHeight: 13 }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } },
    yAxis: { type: "value", min: 0, axisLabel: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } },
    series: [{ name: "Cumulative points", type: "line", data: totals, smooth: 0.14, connectNulls: false, showSymbol: true, symbolSize: 8, lineStyle: { color: theme.green, width: 2.5 }, itemStyle: { color: theme.green, borderColor: theme.background, borderWidth: 2 }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${theme.green}2b` }, { offset: 1, color: "#00000000" }] } } }],
  };
  return <><div className="chart-wrap driver-points-chart" role="group" aria-label="Driver cumulative championship points by scoring session"><ReactECharts notMerge style={{ height: "100%", minHeight: 280 }} option={option} opts={{ renderer: "svg" }} /></div><details className="chart-table-details"><summary className="chart-table-toggle">OPEN POINTS TABLE</summary><div className="table-scroll" role="region" aria-label="Championship points data table" tabIndex={0}><table className="data-table chart-data-table"><thead><tr><th>Circuit</th><th>Session</th><th>Event points</th><th>Total points</th></tr></thead><tbody>{rows.map((item, index) => <tr key={item.sessionKey}><td>{item.circuit}</td><td>{item.sessionCode}</td><td className="mono">{item.points}</td><td className="mono">{totals[index]}</td></tr>)}</tbody></table></div></details></>;
}

function RacecraftChart({ sessions }: { sessions: DriverAnalysisSession[] }) {
  const rows = completedSessions(sessions).filter((session) => session.grid !== undefined && session.position !== undefined);
  if (!rows.length) return <div className="empty">Grid position data is not available for this driver yet.</div>;
  const option = {
    backgroundColor: "transparent", animation: false, aria: { enabled: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true, padding: [10, 12], backgroundColor: `${theme.surface}f7`, borderColor: `${theme.red}66`, textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }, formatter: (params: unknown) => { const session = rows[tooltipDataIndex(params)]; if (!session || session.grid === undefined || session.position === undefined) return "—"; const gain = session.grid - session.position; return `<b>${session.circuit} · ${session.sessionCode}</b><br/>Grid P${session.grid} → Finish P${session.position}<br/>Net: <b>${gain >= 0 ? "+" : ""}${gain} positions</b>`; } },
    grid: { left: 54, right: 22, top: 34, bottom: 58, containLabel: true },
    xAxis: { type: "category", data: rows.map(compactSessionLabel), axisLabel: { color: theme.text, fontSize: 10, fontFamily: "JetBrains Mono, monospace", interval: "auto", hideOverlap: true, rotate: 0, lineHeight: 13 }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } },
    yAxis: { type: "value", axisLabel: { color: theme.text, fontSize: 10, fontFamily: "JetBrains Mono, monospace", formatter: (item: unknown) => `${Number(item) > 0 ? "+" : ""}${item}` }, axisLine: { show: false }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } },
    series: [{ type: "bar", name: "Positions gained", barMaxWidth: 24, data: rows.map((session) => { const gain = (session.grid as number) - (session.position as number); return { value: gain, itemStyle: { color: gain >= 0 ? theme.green : theme.red, borderRadius: gain >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } }; }) }],
  };
  return <><div className="chart-wrap driver-racecraft-chart" role="group" aria-label="Driver positions gained from grid to finish"><ReactECharts notMerge style={{ height: "100%", minHeight: 280 }} option={option} opts={{ renderer: "svg" }} /></div><details className="chart-table-details"><summary className="chart-table-toggle">OPEN RACECRAFT TABLE</summary><div className="table-scroll" role="region" aria-label="Grid to finish data table" tabIndex={0}><table className="data-table chart-data-table"><thead><tr><th>Circuit</th><th>Session</th><th>Grid</th><th>Finish</th><th>Delta</th></tr></thead><tbody>{rows.map((item) => { const gain = (item.grid as number) - (item.position as number); return <tr key={item.sessionKey}><td>{item.circuit}</td><td>{item.sessionCode}</td><td className="mono">P{item.grid}</td><td className="mono">P{item.position}</td><td className="mono">{gain >= 0 ? "+" : ""}{gain}</td></tr>; })}</tbody></table></div></details></>;
}

function StintTimeline({ snapshot }: { snapshot: DriverAnalysisSnapshot }) {
  const stints = snapshot.selectedAnalytics?.stints.filter((stint) => stint.code.toUpperCase() === snapshot.driver.code.toUpperCase()) ?? [];
  if (!stints.length) return <div className="empty">Tyre stint data is not available for the selected session.</div>;
  const maxLap = Math.max(1, ...stints.map((stint) => stint.endLap));
  return <div className="driver-stint-timeline" role="img" aria-label={`Tyre stint timeline for ${snapshot.driver.name}`}><div className="driver-stint-axis"><span>L1</span><span>L{maxLap}</span></div>{stints.map((stint) => <div className="driver-stint-row" key={`${stint.code}-${stint.stint}`}><b>{stint.compound}</b><div className="driver-stint-track"><span className="driver-stint-block" style={{ left: `${stint.startLap / maxLap * 100}%`, width: `${Math.max(3, (stint.endLap - stint.startLap + 1) / maxLap * 100)}%`, "--stint-color": stint.compound.toLowerCase().includes("soft") ? theme.red : stint.compound.toLowerCase().includes("medium") ? theme.amber : stint.compound.toLowerCase().includes("hard") ? theme.text : theme.cyan } as React.CSSProperties}>{stint.lapCount} LAPS</span></div><small>{stint.degradationPerLap === undefined ? "—" : `${stint.degradationPerLap >= 0 ? "+" : ""}${stint.degradationPerLap.toFixed(3)} s/lap`}</small></div>)}</div>;
}

function WeatherSummary({ snapshot }: { snapshot: DriverAnalysisSnapshot }) {
  const weather = snapshot.selectedAnalytics?.weather;
  const fields = [["AIR", weather?.airTemperature === undefined ? "—" : `${weather.airTemperature.toFixed(1)} °C`], ["TRACK", weather?.trackTemperature === undefined ? "—" : `${weather.trackTemperature.toFixed(1)} °C`], ["HUMIDITY", weather?.humidity === undefined ? "—" : `${weather.humidity.toFixed(1)} %`], ["RAIN", weather?.rainfall === undefined ? "—" : weather.rainfall ? "DETECTED" : "DRY"]];
  return <dl className="driver-weather-grid">{fields.map(([label, fieldValue]) => <div key={label}><dt>{label}</dt><dd>{fieldValue}</dd></div>)}</dl>;
}

function TelemetryChart({ telemetry }: { telemetry: DriverTelemetrySnapshot }) {
  if (!telemetry.available || !telemetry.samples.length) return null;
  const has = (field: "speed" | "throttle" | "brake" | "gear") => telemetry.fields.includes(field);
  const option = {
    backgroundColor: "transparent", animation: false, aria: { enabled: true },
    tooltip: { trigger: "axis", confine: true, backgroundColor: `${theme.surface}f7`, borderColor: `${theme.cyan}66`, textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 } },
    legend: { top: 10, left: 12, textStyle: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }, data: ["SPEED", "THROTTLE", "BRAKE", "GEAR"].filter((label) => has(label.toLowerCase() as "speed" | "throttle" | "brake" | "gear")) },
    grid: { left: 46, right: 48, top: 48, bottom: 28, containLabel: true },
    xAxis: { type: "category", data: telemetry.samples.map((_, index) => index + 1), name: "SAMPLE", axisLabel: { color: theme.muted, fontSize: 9, hideOverlap: true }, axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false } },
    yAxis: [{ type: "value", name: "SPEED · KM/H", axisLabel: { color: theme.muted, fontSize: 9 }, splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } } }, { type: "value", name: "% / GEAR", min: 0, max: 100, axisLabel: { color: theme.muted, fontSize: 9 }, splitLine: { show: false } }],
    series: [
      ...(has("speed") ? [{ name: "SPEED", type: "line", yAxisIndex: 0, showSymbol: false, connectNulls: false, data: telemetry.samples.map((sample) => sample.speed ?? null), lineStyle: { color: theme.cyan, width: 2 }, itemStyle: { color: theme.cyan } }] : []),
      ...(has("throttle") ? [{ name: "THROTTLE", type: "line", yAxisIndex: 1, showSymbol: false, connectNulls: false, data: telemetry.samples.map((sample) => sample.throttle ?? null), lineStyle: { color: theme.green, width: 1.8 }, itemStyle: { color: theme.green } }] : []),
      ...(has("brake") ? [{ name: "BRAKE", type: "line", yAxisIndex: 1, showSymbol: false, connectNulls: false, data: telemetry.samples.map((sample) => sample.brake ?? null), lineStyle: { color: theme.red, width: 1.8 }, itemStyle: { color: theme.red } }] : []),
      ...(has("gear") ? [{ name: "GEAR", type: "line", yAxisIndex: 1, showSymbol: false, connectNulls: false, data: telemetry.samples.map((sample) => sample.gear ?? null), lineStyle: { color: theme.amber, width: 1.5, type: "dashed" }, itemStyle: { color: theme.amber } }] : []),
    ],
  };
  return <><div className="chart-wrap driver-telemetry-chart" role="group" aria-label="Validated driver telemetry trace"><ReactECharts notMerge style={{ height: "100%", minHeight: 280 }} option={option} opts={{ renderer: "svg" }} /></div><details className="chart-table-details"><summary className="chart-table-toggle">OPEN TELEMETRY TABLE</summary><div className="table-scroll"><table className="data-table chart-data-table"><thead><tr><th>Sample</th>{telemetry.fields.map((field) => <th key={field}>{field}</th>)}</tr></thead><tbody>{telemetry.samples.slice(0, 80).map((sample, index) => <tr key={index}><td>{index + 1}</td>{telemetry.fields.map((field) => <td key={field}>{sample[field as "speed" | "throttle" | "brake" | "gear"] ?? "—"}</td>)}</tr>)}</tbody></table></div></details></>;
}

export function DriverAnalysisView({ snapshot, locale, timezone, filters }: { snapshot: DriverAnalysisSnapshot; locale: Locale; timezone: string; filters?: { season?: string; round?: string; circuit?: string; sessionCode?: string; sessionKey?: string } }) {
  const [context, setContext] = useState<"teammate" | "field">("teammate");
  const driver = snapshot.driver;
  const color = getTeamColor(driver.team, driver.color);
  const selectedAnalytics = snapshot.selectedAnalytics;
  const teammateCode = selectedAnalytics?.results.find((result) => result.code !== driver.code && result.team === driver.team)?.code;
  const paceSeries = useMemo(() => {
    if (!selectedAnalytics) return [];
    if (context === "teammate" && teammateCode) return selectedAnalytics.pace.series.filter((series) => [driver.code, teammateCode].includes(series.code));
    return selectedAnalytics.pace.series.filter((series) => series.code === driver.code || selectedAnalytics.results.some((result) => result.code === series.code)).slice(0, 4);
  }, [context, driver.code, selectedAnalytics, teammateCode]);
  const paceData = selectedAnalytics ? { ...selectedAnalytics.pace, series: paceSeries, defaultCodes: paceSeries.map((series) => series.code) } : undefined;
  const summary = snapshot.summary;
  const session = snapshot.selectedSession;
  const telemetry = snapshot.telemetry;
  const racecraft = snapshot.racecraft;
  const fastF1Metrics = selectedAnalytics?.source === "FastF1" ? selectedAnalytics.driverMetrics?.[driver.code.toUpperCase()] : undefined;
  const fastF1Availability = selectedAnalytics?.source === "FastF1" ? selectedAnalytics.driverAvailability?.[driver.code.toUpperCase()] : undefined;
  const compareLabel = locale === "th" ? "เปรียบเทียบนักขับ" : "COMPARE DRIVER";

  return <div className="driver-analysis-page" style={{ "--driver-color": color } as React.CSSProperties}>
    <section className="driver-profile-hero">
      <div className="driver-profile-copy"><Link href="/drivers" className="driver-back-link">← DRIVERS DIRECTORY</Link><div className="eyebrow">DRIVER ANALYSIS · {snapshot.season}</div><div className="driver-profile-heading"><div className="driver-profile-mark" aria-hidden="true">{getTeamMark(driver.team)}</div><div><h1>{driver.name}</h1><p><b>{driver.code}</b> · {driver.team}{driver.nationality ? ` · ${driver.nationality}` : ""}</p></div></div><div className="driver-profile-actions"><Link href={`/compare?drivers=${encodeURIComponent(driver.code)}`} className="primary-cta">{compareLabel} <span>↗</span></Link><span className={`driver-provider-status ${snapshot.status === "complete" ? "ready" : "pending"}`} role="status"><i aria-hidden="true" />{snapshot.source.toUpperCase()} · {snapshot.status.replaceAll("_", " ")}</span></div></div>
      <div className="driver-profile-rank"><small>CHAMPIONSHIP</small><strong>P{String(driver.position).padStart(2, "0")}</strong><span>{driver.points ?? "—"} POINTS · {driver.wins ?? "—"} WINS</span></div>
    </section>

    <nav className="driver-section-nav" aria-label="Driver analysis sections"><span>JUMP TO</span><a href="#driver-guide">Guide</a><a href="#driver-overview">Overview</a><a href="#driver-form">Results</a><a href="#driver-pace">Pace</a><a href="#driver-strategy">Strategy</a><a href="#driver-telemetry">Telemetry</a><a href="#driver-sessions">Sessions</a></nav>

    <section id="driver-guide" className="driver-reading-guide" aria-labelledby="driver-guide-title"><div className="driver-guide-heading"><div><div className="eyebrow">START HERE</div><h2 id="driver-guide-title">How to read this driver</h2></div><p>Read the story in order: result, pace, strategy, then the detailed trace.</p></div><div className="driver-guide-grid"><article><span>01 · RESULTS</span><h3>Where did they finish?</h3><p>Finish position and cumulative points show the season outcome.</p></article><article><span>02 · PACE</span><h3>How fast were they?</h3><p>Clean-lap pace and consistency show repeatable speed, not just one lap.</p></article><article><span>03 · STRATEGY</span><h3>How did the tyres work?</h3><p>Stints show compound choice, lap count and degradation.</p></article><article><span>04 · TELEMETRY</span><h3>Where was time made?</h3><p>Speed, throttle, brake and gear appear only after FastF1 validation.</p></article></div></section>

    <section className="driver-filter-panel panel" aria-label="Driver analysis filters"><div className="driver-filter-heading"><div><div className="eyebrow">ANALYSIS CONTROLS</div><h2>Choose a view</h2></div><p>Defaults to the latest available session.</p></div><form method="get"><label>SEASON<select className="select" name="season" defaultValue={filters?.season ?? String(snapshot.season)}><option value={snapshot.season}>{snapshot.season}</option></select></label><label>ROUND<select className="select" name="round" defaultValue={filters?.round ?? "ALL"}><option value="ALL">ALL ROUNDS</option>{Array.from(new Set(snapshot.sessions.map((item) => item.round).filter((round) => round > 0))).sort((a, b) => a - b).map((round) => <option key={round} value={round}>ROUND {String(round).padStart(2, "0")}</option>)}</select></label><label>CIRCUIT<select className="select" name="circuit" defaultValue={filters?.circuit ?? "ALL"}><option value="ALL">ALL CIRCUITS</option>{Array.from(new Set(snapshot.sessions.map((item) => item.circuit).filter(Boolean))).map((circuit) => <option key={circuit} value={circuit}>{circuit}</option>)}</select></label><label>SESSION TYPE<select className="select" name="sessionCode" defaultValue={filters?.sessionCode ?? "ALL"}><option value="ALL">ALL SESSION TYPES</option>{["R", "Q", "SPR", "SQ", "FP1", "FP2", "FP3"].map((code) => <option key={code} value={code}>{code}</option>)}</select></label><label>SESSION<select className="select" name="sessionKey" defaultValue={filters?.sessionKey ?? (session?.sessionKey ? String(session.sessionKey) : "ALL")}><option value="ALL">LATEST MATCH</option>{snapshot.sessions.map((item) => <option key={item.sessionKey} value={item.sessionKey}>{item.sessionCode} · {item.circuit}</option>)}</select></label><div className="driver-filter-actions"><button type="submit" className="button">APPLY FILTERS</button><Link href={`/drivers/${driver.code.toLowerCase()}`} className="button-secondary">RESET</Link></div></form><div className="driver-context-toggle" role="group" aria-label="Pace comparison context"><span>PACE CONTEXT</span><button type="button" className={context === "teammate" ? "active" : ""} onClick={() => setContext("teammate")} aria-pressed={context === "teammate"}>TEAMMATE</button><button type="button" className={context === "field" ? "active" : ""} onClick={() => setContext("field")} aria-pressed={context === "field"}>SESSION FIELD</button></div></section>

    <section id="driver-overview" className="section driver-kpi-grid" aria-label="Driver summary metrics"><article><span>AVERAGE FINISH</span><strong>{formatAverageFinish(summary.averageFinish)}</strong><small>{summary.validSessions} classified sessions</small></article><article><span>BEST FINISH</span><strong>{summary.bestFinish === undefined ? "—" : `P${summary.bestFinish}`}</strong><small>season result</small></article><article><span>POSITIONS GAINED</span><strong>{summary.positionsGained === undefined ? "—" : `${summary.positionsGained >= 0 ? "+" : ""}${summary.positionsGained}`}</strong><small>grid to finish</small></article><article><span>VALID LAPS</span><strong>{summary.validLaps || "—"}</strong><small>{summary.dnf} DNF · {summary.dns} DNS · {summary.dsq} DSQ</small></article></section>

    <section className="section driver-analysis-grid driver-results-grid"><article id="driver-form" className="panel driver-analysis-card driver-form-card"><div className="section-heading"><div><div className="eyebrow">RESULTS</div><h2>Race finishes</h2></div><p>P1 IS BEST · JOLPICA RESULTS</p></div><FormChart sessions={snapshot.sessions} /></article><article className="panel driver-analysis-card driver-points-card"><div className="section-heading"><div><div className="eyebrow">CHAMPIONSHIP</div><h2>Points momentum</h2></div><p>SEASON TOTAL AFTER EACH SCORING SESSION</p></div><PointsMomentumChart sessions={snapshot.sessions} /></article><article className="panel driver-analysis-card driver-racecraft-panel"><div className="section-heading"><div><div className="eyebrow">RACECRAFT</div><h2>Grid to finish</h2></div><p>POSITIVE = POSITIONS GAINED · {racecraft?.source === "FastF1" ? "FASTF1 VALIDATED" : "FASTF1 PENDING"}</p></div><RacecraftChart sessions={snapshot.sessions} /><div className="driver-racecraft-stats"><span><small>FASTF1 POSITION DELTA</small><b>{racecraft?.positionsGained === undefined ? "—" : `${racecraft.positionsGained >= 0 ? "+" : ""}${racecraft.positionsGained}`}</b></span><span><small>OVERTAKES MADE</small><b>{racecraft?.overtakesMade ?? "—"}</b></span><span><small>OVERTAKES LOST</small><b>{racecraft?.overtakesLost ?? "—"}</b></span><span><small>RACE CONTROL</small><b>{racecraft?.raceControlEvents ?? "—"}</b></span></div></article></section>

    <section id="driver-pace" className="section panel driver-pace-panel"><div className="section-heading"><div><div className="eyebrow">PACE ANALYSIS</div><h2>{session ? `${session.circuit} · ${session.sessionCode}` : "Selected session pace"}</h2></div><p>{context === "teammate" ? "TEAMMATE CONTEXT" : "SESSION FIELD"}<br />{selectedAnalytics?.source === "FastF1" ? "FASTF1 · VALIDATED ANALYSIS" : selectedAnalytics?.source === "OpenF1" ? "OPENF1 · PROVISIONAL CONTEXT" : "PROVIDER DATA UNAVAILABLE"}</p></div>{fastF1Availability && fastF1Availability.status !== "complete" ? <div className="driver-data-note" role="note"><strong>FASTF1 DATA · {fastF1Availability.status.replaceAll("_", " ").toUpperCase()}</strong><span>{fastF1Availability.reason}</span><small>{fastF1Availability.validLaps} valid laps · {fastF1Availability.telemetrySamples} telemetry samples</small></div> : null}{fastF1Metrics ? <div className="driver-fastf1-metrics" aria-label="FastF1 validated driver metrics"><article><span>CLEAN-LAP MEDIAN</span><strong>{fastF1Seconds(fastF1Metrics.cleanLapMedian)}</strong></article><article><span>BEST LAP</span><strong>{fastF1Seconds(fastF1Metrics.bestLap)}</strong></article><article><span>THEORETICAL BEST</span><strong>{fastF1Seconds(fastF1Metrics.theoreticalBest)}</strong></article><article><span>CONSISTENCY</span><strong>{fastF1Seconds(fastF1Metrics.consistency)}</strong></article><article><span>DEGRADATION</span><strong>{fastF1Seconds(fastF1Metrics.degradationSlope)}</strong></article><article><span>VALID LAPS</span><strong>{fastF1Metrics.validLaps ?? "—"}</strong></article></div> : null}{paceData ? <PaceChart data={paceData} /> : <div className="empty">Select a completed session to inspect FastF1 pace. Metrics appear after a validated artifact is published.</div>}</section>

    <section id="driver-strategy" className="section driver-analysis-grid"><article className="panel driver-analysis-card"><div className="section-heading"><div><div className="eyebrow">STRATEGY</div><h2>Tyre stints</h2></div><p>{session?.sessionName ?? "Selected session"}</p></div><StintTimeline snapshot={snapshot} /></article><article className="panel driver-analysis-card"><div className="section-heading"><div><div className="eyebrow">CONDITIONS</div><h2>Track weather</h2></div><p>OPENF1</p></div><WeatherSummary snapshot={snapshot} /></article></section>

    <section id="driver-telemetry" className="section panel driver-telemetry-panel"><div className="section-heading"><div><div className="eyebrow">ADVANCED DATA</div><h2>Telemetry trace</h2></div><p>{telemetry?.source === "FastF1" ? "FASTF1 · VALIDATED ARTIFACT" : "OPENF1 · SESSION CONTEXT"}</p></div>{telemetry?.available ? <><div className="driver-telemetry-empty"><span className="status-dot ready" aria-hidden="true" /><div><strong>{telemetry.source === "FastF1" ? "FastF1 telemetry artifact available" : "OpenF1 car data available"}</strong><p>{telemetry.sampleCount} samples · {telemetry.fields.join(", ")} available.{telemetry.source === "FastF1" ? " Derived by the worker from the fastest validated lap." : " FastF1 artifact is not available for this session yet."}</p></div></div><TelemetryChart telemetry={telemetry} /></> : <div className="driver-telemetry-empty"><span className="status-dot pending" aria-hidden="true" /><div><strong>Telemetry artifact pending</strong><p>Speed, throttle, brake and gear traces will appear after the FastF1 worker publishes a validated artifact for this session.</p></div></div>}</section>

    <section id="driver-sessions" className="section panel driver-sessions-panel"><div className="section-heading"><div><div className="eyebrow">DATA TABLE</div><h2>Session record</h2></div><p>{snapshot.sessions.length} sessions · {timezone}</p></div><div className="driver-data-note" role="note"><strong>{snapshot.status.replaceAll("_", " ").toUpperCase()}</strong><span>{snapshot.source} snapshot · {snapshot.sessions.length} sessions indexed</span><small>“—” means the provider has not returned a validated value for that field.</small></div><div className="table-scroll" role="region" aria-label="Driver session record" tabIndex={0}><table className="data-table driver-session-table"><thead><tr><th>Session</th><th>Circuit</th><th>Status</th><th>Pos</th><th>Grid</th><th>Delta</th><th>Source</th></tr></thead><tbody>{snapshot.sessions.map((item) => <tr key={item.sessionKey}><td><b>{item.sessionCode}</b><br /><small>{item.sessionName}</small></td><td>{item.circuit}<br /><small>ROUND {item.round || "—"}</small></td><td><span className={`badge ${item.status}`}>{item.status}</span></td><td className="mono">{item.position ? `P${item.position}` : "—"}</td><td className="mono">{item.grid ?? "—"}</td><td className="mono">{item.grid !== undefined && item.position !== undefined ? `${item.grid - item.position >= 0 ? "+" : ""}${item.grid - item.position}` : "—"}</td><td className="mono">{item.source}</td></tr>)}</tbody></table></div></section>
  </div>;
}
