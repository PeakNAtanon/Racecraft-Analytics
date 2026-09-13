import type { DriverAnalysisSession, DriverAnalysisSummary, PaceSeries } from "./types";

export function selectDriverPaceSeries(series: PaceSeries[], driverCode: string, teammateCode?: string): PaceSeries[] {
  const selected = series.filter(item => item.code.toUpperCase() === driverCode.toUpperCase());
  const others = series.filter(item => item.code.toUpperCase() !== driverCode.toUpperCase()
    && (!teammateCode || item.code.toUpperCase() === teammateCode.toUpperCase()));
  return [...selected, ...others].slice(0, teammateCode ? 2 : 4);
}

export function calculateDriverSummary(sessions: DriverAnalysisSession[]): DriverAnalysisSummary {
  const raceSessions = sessions.filter((session) => session.sessionCode === "R" || session.sessionCode === "SPR");
  const results = raceSessions.filter((session) => session.resultStatus === "CLASSIFIED" && typeof session.position === "number" && Number.isFinite(session.position));
  const finishes = results.map((session) => session.position as number);
  const positionsGained = results
    .filter((session) => typeof session.grid === "number" && Number.isFinite(session.grid))
    .reduce((total, session) => total + (session.grid as number) - (session.position as number), 0);

  return {
    averageFinish: finishes.length ? finishes.reduce((total, value) => total + value, 0) / finishes.length : undefined,
    bestFinish: finishes.length ? Math.min(...finishes) : undefined,
    validSessions: results.length,
    validLaps: sessions.reduce((total, session) => total + (session.validLaps ?? 0), 0),
    classified: raceSessions.filter((session) => session.resultStatus === "CLASSIFIED").length,
    dnf: raceSessions.filter((session) => session.resultStatus === "DNF").length,
    dns: raceSessions.filter((session) => session.resultStatus === "DNS").length,
    dsq: raceSessions.filter((session) => session.resultStatus === "DSQ").length,
    ...(results.some((session) => typeof session.grid === "number" && typeof session.position === "number") ? { positionsGained } : {}),
  };
}

export function formatAverageFinish(value: number | undefined) {
  return value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(1);
}
