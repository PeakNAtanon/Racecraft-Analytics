import type { ComparisonFilters } from "./compare";
import type { ComparisonSession, SessionResult } from "./types";

export function referenceSeasonSessions(primary: ComparisonSession[], reference: ComparisonSession[], filters: ComparisonFilters) {
  const circuits = new Set(primary.map(session => session.circuit));
  return reference.filter(session => (filters.session === "ALL" || session.sessionCode === filters.session)
    && (filters.circuit === "ALL" || session.circuit === filters.circuit)
    && (filters.round === "ALL" || circuits.has(session.circuit)));
}

export function seasonDriverStats(sessions: ComparisonSession[], code: string) {
  const results = sessions.map(session => session.results.find(result => result.code === code)).filter((result): result is SessionResult => Boolean(result));
  const positions = results.filter(result => result.status === "CLASSIFIED" && typeof result.position === "number" && Number.isFinite(result.position)).map(result => result.position!);
  const points = results.flatMap(result => typeof result.points === "number" && Number.isFinite(result.points) ? [result.points] : []);
  return {
    samples: results.length,
    classified: positions.length,
    averagePosition: positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : undefined,
    points: points.length === results.length && points.length ? points.reduce((a, b) => a + b, 0) : undefined,
  };
}
