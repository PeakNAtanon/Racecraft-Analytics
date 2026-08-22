"use client";

import ReactECharts from "echarts-for-react";
import { formatChartNumber, formatLapTooltipValue } from "@/lib/chart-format";
import type { PaceChartData, PaceSeries } from "@/lib/types";

const theme = {
  background: "#0a0c0f",
  surface: "#12161c",
  text: "#f5f7fa",
  muted: "#a6b0bf",
  line: "#29313d",
  cyan: "#39c6f4",
  red: "#ff3b30",
  amber: "#f4b740",
  green: "#3ddc97",
};

const fallbackColors = [theme.cyan, theme.red, theme.amber, theme.green];
const lineTypes = ["solid", "dashed", "dotted", "solid"] as const;

const area = (top: string) => ({
  type: "linear",
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: top },
    { offset: 1, color: "#00000000" },
  ],
});

function selectSeries(data: PaceChartData) {
  const defaultCodes = data.defaultCodes ?? [];
  if (!defaultCodes.length) return data.series.slice(0, 2);
  return defaultCodes.map(code => data.series.find(series => series.code === code)).filter((series): series is PaceSeries => Boolean(series));
}

function validValues(series: PaceSeries) {
  return series.values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

export function PaceChart({ data }: { data: PaceChartData }) {
  const seriesData = selectSeries(data);
  if (!seriesData.length || !data.laps.length) {
    return <div className="empty">ยังไม่มีข้อมูล lap ที่ผ่าน validation สำหรับ session นี้</div>;
  }

  const colors = seriesData.map((series, index) => series.color ?? fallbackColors[index % fallbackColors.length]);
  const valueGroups = seriesData.map(validValues);
  const allValues = valueGroups.flat();
  const missingValues = seriesData.reduce((total, series) => total + series.values.filter(value => value === null || value === undefined).length, 0);
  const fastest = allValues.length ? Math.min(...allValues) : null;
  const seriesBests = valueGroups.map(values => values.length ? Math.min(...values) : null).filter((value): value is number => value !== null);
  const paceGap = seriesBests.length > 1 ? [...seriesBests].sort((a, b) => a - b)[1] - Math.min(...seriesBests) : null;
  const fastestSeriesIndex = fastest === null ? -1 : valueGroups.findIndex(values => values.includes(fastest));
  const fastestSeries = fastestSeriesIndex >= 0 ? seriesData[fastestSeriesIndex] : undefined;
  const fastestLapIndex = fastestSeriesIndex >= 0 && fastest !== null ? seriesData[fastestSeriesIndex].values.findIndex(value => value === fastest) : -1;
  const fastestLapLabel = fastestLapIndex >= 0 ? `LAP ${data.laps[fastestLapIndex]}` : "Validated data";
  const range = allValues.length ? Math.max(...allValues) - Math.min(...allValues) : 1;
  const padding = Math.max(0.08, range * 0.14);
  const yMin = allValues.length ? Math.min(...allValues) - padding : 0;
  const yMax = allValues.length ? Math.max(...allValues) + padding : 1;
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
      borderColor: `${theme.cyan}66`,
      borderWidth: 1,
      extraCssText: "box-shadow: 0 12px 32px rgba(0,0,0,.36); border-radius: 8px;",
      textStyle: { color: theme.text, fontFamily: "JetBrains Mono, monospace", fontSize: 11 },
      axisPointer: { type: "cross", lineStyle: { color: "#ffffff55", width: 1 }, crossStyle: { color: "#ffffff55" }, label: { backgroundColor: theme.cyan, color: theme.background, fontFamily: "JetBrains Mono, monospace" } },
      valueFormatter: (value: unknown) => formatLapTooltipValue(value),
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
      pageIconColor: theme.cyan,
      pageTextStyle: { color: theme.muted, fontFamily: "JetBrains Mono, monospace", fontSize: 10 },
      textStyle: { color: theme.muted, fontSize: 11, fontFamily: "JetBrains Mono, monospace" },
      data: seriesData.map(series => series.code),
    },
    grid: { left: 54, right: 24, top: 56, bottom: 46, containLabel: true },
    xAxis: {
      type: "category",
      name: "LAP",
      nameLocation: "middle",
      nameGap: 28,
      data: data.laps,
      boundaryGap: false,
      axisTick: { show: false },
      axisLabel: { color: theme.muted, fontSize: 11, fontFamily: "JetBrains Mono, monospace", hideOverlap: true, margin: 12 },
      axisLine: { lineStyle: { color: theme.line } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "LAP TIME · SEC",
      nameGap: 38,
      nameTextStyle: { color: theme.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" },
      min: yMin,
      max: yMax,
      inverse: true,
      axisLabel: { color: theme.muted, fontSize: 11, fontFamily: "JetBrains Mono, monospace", formatter: (value: unknown) => formatChartNumber(value) },
      axisLine: { show: false },
      axisTick: { show: false },
      splitNumber: 4,
      splitLine: { lineStyle: { color: "#ffffff14", type: "dashed" } },
    },
    series: seriesData.map((series, index) => ({
      name: series.code,
      type: "line",
      data: series.values,
      smooth: 0.2,
      connectNulls: false,
      showSymbol: false,
      symbol: index % 2 === 0 ? "circle" : "diamond",
      symbolSize: 8,
      z: seriesData.length - index,
      lineStyle: { color: colors[index], type: lineTypes[index % lineTypes.length], width: 2.5, shadowBlur: 8, shadowColor: `${colors[index]}70` },
      itemStyle: { color: colors[index], borderColor: theme.background, borderWidth: 2 },
      areaStyle: index === 0 ? { color: area(`${colors[index]}20`) } : undefined,
      emphasis: { focus: "series", showSymbol: true, lineStyle: { width: 3.5 } },
    })),
  };

  return (
    <>
      <div className="chart-context"><span>{data.sessionLabel}</span><span className={missingValues ? "chart-gap-note" : undefined}>{data.source === "FastF1" ? (missingValues ? `GAPS ${missingValues} · MISSING VALIDATED LAPS` : "FASTF1 VALIDATED ARTIFACT") : data.source === "OpenF1" ? (missingValues ? `GAPS ${missingValues} · MISSING SESSION LAPS` : "OPENF1 SESSION CONTEXT") : "AWAITING PROVIDER DATA"}</span></div>
      <div className="chart-stat-strip" aria-label="Lap pace summary">
        <div className="chart-stat accent"><span>FASTEST LAP</span><strong>{formatLapTooltipValue(fastest)}</strong><small>{fastestSeries?.name ? `${fastestSeries.name} · ${fastestLapLabel}` : fastestLapLabel}</small></div>
        <div className="chart-stat"><span>PACE GAP</span><strong>{paceGap === null ? "—" : `+${paceGap.toFixed(3)} s`}</strong><small>best selected drivers</small></div>
        <div className="chart-stat"><span>VALID SAMPLES</span><strong>{allValues.length}</strong><small>{seriesData.length} drivers selected</small></div>
      </div>
      <div className="chart-wrap" role="group" aria-label={`Lap pace comparison for ${seriesData.map(series => series.name).join(" and ")}`}>
        <ReactECharts notMerge style={{ height: "100%", minHeight: 280 }} option={option} opts={{ renderer: "svg" }} />
      </div>
      <details className="chart-table-details">
        <summary className="chart-table-toggle">OPEN DATA TABLE</summary>
        <div className="table-scroll">
          <table className="data-table chart-data-table" aria-label="Lap pace data table">
            <thead><tr><th scope="col">Lap</th>{seriesData.map(series => <th scope="col" key={series.code}>{series.code}</th>)}</tr></thead>
            <tbody>
              {data.laps.map((lap, index) => (
                <tr key={lap}><td>{lap}</td>{seriesData.map(series => <td key={series.code}>{series.values[index] === null || series.values[index] === undefined ? "—" : `${series.values[index]?.toFixed(3)} s`}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
