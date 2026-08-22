"use client";

import ReactECharts from "echarts-for-react";
import { formatChartNumber, formatPositionTooltipValue } from "@/lib/chart-format";
import type { Locale } from "@/lib/i18n";
import { message } from "@/lib/i18n";
import { getTeamColor } from "@/lib/team-colors";
import type { SeasonComparisonSnapshot } from "@/lib/types";

const theme = { background: "#0a0c0f", surface: "#12161c", text: "#f5f7fa", muted: "#a6b0bf", line: "#29313d" };
const fallbackColors = ["#39c6f4", "#ff3b30", "#f4b740", "#3ddc97"];
const lineTypes = ["solid", "dashed", "dotted", "solid"] as const;

function labelForSession(circuit: string, code: string) {
  return `${circuit}\n${code}`;
}

function positionStats(sessions: SeasonComparisonSnapshot["sessions"], code: string) {
  const positions = sessions.map(session => session.results.find(result => result.code === code && result.status === "CLASSIFIED")?.position).filter((position): position is number => typeof position === "number" && Number.isFinite(position));
  return {
    best: positions.length ? Math.min(...positions) : null,
    average: positions.length ? positions.reduce((total, position) => total + position, 0) / positions.length : null,
    latest: positions.at(-1) ?? null,
  };
}

function formatPosition(position: number | null) {
  return position === null ? "—" : `P${position}`;
}

export function SeasonComparisonChart({ comparison, activeDrivers, locale }: { comparison: SeasonComparisonSnapshot; activeDrivers: string[]; locale: Locale }) {
  const sessions = comparison.sessions.filter(session => session.results.length > 0);
  const selected = activeDrivers.filter(code => comparison.drivers.some(driver => driver.code === code));

  if (!sessions.length || !selected.length) {
    return <div className="empty">{message(locale, "comparisonNoData")}</div>;
  }

  const labels = sessions.map(session => labelForSession(session.circuit, session.sessionCode));
  const colors = selected.map((code, index) => {
    const driver = comparison.drivers.find(item => item.code === code);
    return getTeamColor(driver?.team, driver?.color) ?? fallbackColors[index % fallbackColors.length];
  });
  const maxPosition = Math.max(1, ...sessions.flatMap(session => session.results.flatMap(result => result.status !== "CLASSIFIED" || result.position === undefined ? [] : [result.position])));
  const findPosition = (sessionIndex: number, code: string) => {
    const result = sessions[sessionIndex].results.find(item => item.code === code && item.status === "CLASSIFIED");
    return result?.position ?? null;
  };
  const selectedStats = selected.map(code => positionStats(sessions, code));
  const bestFinish = selectedStats.reduce<number | null>((best, stats) => stats.best === null ? best : best === null ? stats.best : Math.min(best, stats.best), null);
  const bestAverage = selectedStats.reduce<number | null>((best, stats) => stats.average === null ? best : best === null ? stats.average : Math.min(best, stats.average), null);
  const series = selected.map((code, index) => ({
    name: code,
    type: "line",
    data: sessions.map((_, sessionIndex) => findPosition(sessionIndex, code)),
    connectNulls: false,
    showSymbol: false,
    symbol: index % 2 === 0 ? "circle" : "diamond",
    symbolSize: 8,
    z: selected.length - index,
    lineStyle: { color: colors[index], type: lineTypes[index % lineTypes.length], width: 2.5, shadowBlur: 8, shadowColor: `${colors[index]}70` },
    itemStyle: { color: colors[index], borderColor: theme.background, borderWidth: 2 },
    emphasis: { focus: "series", showSymbol: true, lineStyle: { width: 3.5 } },
  }));
  const labelInterval = sessions.length > 8 ? Math.max(0, Math.ceil(sessions.length / 8) - 1) : 0;
  const option = {
    backgroundColor: "transparent",
    animation: false,
    aria: { enabled: true },
    color: colors,
    tooltip: {
      trigger: "axis",
      confine: true,
      padding: [10, 12],
      backgroundColor: `${theme.surface}f7`,
      borderColor: `${colors[0]}66`,
      borderWidth: 1,
      extraCssText: "box-shadow: 0 12px 32px rgba(0,0,0,.36); border-radius: 8px;",
      textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 },
      axisPointer: { type: "cross", lineStyle: { color: "#ffffff55", width: 1 }, crossStyle: { color: "#ffffff55" }, label: { backgroundColor: colors[0], color: theme.background, fontFamily: "JetBrains Mono, monospace" } },
      valueFormatter: (value: unknown) => formatPositionTooltipValue(value),
    },
    legend: {
      type: "scroll",
      top: 10,
      left: 12,
      right: 12,
      selectedMode: "multiple",
      icon: "roundRect",
      itemWidth: 18,
      itemHeight: 3,
      itemGap: 18,
      pageButtonItemGap: 6,
      pageIconColor: colors[0],
      pageTextStyle: { color: theme.muted, fontFamily: "JetBrains Mono, monospace", fontSize: 10 },
      textStyle: { color: theme.muted, fontSize: 11, fontFamily: "JetBrains Mono, monospace" },
      data: selected,
    },
    grid: { left: 52, right: 24, top: 56, bottom: 78, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLabel: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace", interval: labelInterval, rotate: 0, lineHeight: 14, margin: 14, hideOverlap: true },
      axisLine: { lineStyle: { color: theme.line } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: message(locale, "comparisonPosition").toUpperCase(),
      nameGap: 38,
      nameTextStyle: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" },
      min: 1,
      max: maxPosition,
      interval: maxPosition > 12 ? 5 : undefined,
      inverse: true,
      axisLabel: { color: theme.muted, fontSize: 11, fontFamily: "JetBrains Mono, monospace", formatter: (value: unknown) => `P${formatChartNumber(value, 0)}` },
      axisLine: { show: false },
      axisTick: { show: false },
      splitNumber: 4,
      splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } },
    },
    series,
  };

  return <>
    <div className="chart-context"><span>{message(locale, "comparisonLegendHint")}</span><span>{sessions.length} {message(locale, "comparisonSessions")} · {new Set(sessions.map(session => session.round || session.circuit)).size} {message(locale, "comparisonCircuits")}</span></div>
    <div className="chart-stat-strip" aria-label="Season comparison summary">
      <div className="chart-stat accent"><span>BEST FINISH</span><strong>{formatPosition(bestFinish)}</strong><small>{selected.join(" · ")}</small></div>
      <div className="chart-stat"><span>BEST AVG POSITION</span><strong>{bestAverage === null ? "—" : `P${bestAverage.toFixed(1)}`}</strong><small>selected drivers</small></div>
      <div className="chart-stat"><span>SESSIONS INDEXED</span><strong>{sessions.length}</strong><small>{new Set(sessions.map(session => session.round || session.circuit)).size} circuits</small></div>
    </div>
    <div className="chart-wrap season-summary-chart" role="group" aria-label={`${message(locale, "comparisonAllSessions")}: ${selected.join(", ")}`}>
      <ReactECharts notMerge style={{ height: "100%", minHeight: 280 }} option={option} opts={{ renderer: "svg" }} />
    </div>
    <details className="chart-table-details">
      <summary className="chart-table-toggle">{message(locale, "comparisonOpenTable")}</summary>
      <div className="table-scroll">
        <table className="data-table comparison-table" aria-label={message(locale, "comparisonAllSessions")}>
          <thead><tr><th scope="col">Session</th><th scope="col">Circuit</th>{selected.map(code => <th scope="col" key={code}>{code}</th>)}</tr></thead>
          <tbody>{sessions.map(session => <tr key={session.sessionKey}>
            <td>{session.sessionCode}</td>
            <td>{session.circuit}</td>
            {selected.map(code => {
              const result = session.results.find(item => item.code === code && item.status === "CLASSIFIED");
              return <td key={code}>{result?.position === undefined ? "—" : `P${result.position}`}</td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </>;
}
