import type { FastF1ArtifactInventoryItem } from "./fastf1-artifacts";
import type { ComparisonSession } from "./types";

export interface ComparisonFilters { session: string; round: string; circuit: string }

export function resolveComparisonFilters(sessions: ComparisonSession[], artifacts: FastF1ArtifactInventoryItem[], query: Partial<ComparisonFilters>): ComparisonFilters {
  const filters = { session: query.session ?? "ALL", round: query.round ?? "ALL", circuit: query.circuit ?? "ALL" };
  if (query.session !== undefined) return filters;
  const candidates = filterComparisonSessions(sessions, filters);
  filters.session = latestFastF1Session(candidates, artifacts)?.sessionCode
    ?? (candidates.some(session => session.sessionCode === "R" && session.results.length) ? "R" : "ALL");
  return filters;
}

export function filterComparisonSessions(sessions: ComparisonSession[], filters: ComparisonFilters) {
  return sessions.filter(session => (filters.session === "ALL" || session.sessionCode === filters.session)
    && (filters.round === "ALL" || String(session.round) === filters.round)
    && (filters.circuit === "ALL" || session.circuit === filters.circuit));
}

export function selectDriverPair(availableCodes: string[], preferredCodes: string[] = [], requestedCodes: string[] = []) {
  const available = new Set(availableCodes);
  return Array.from(new Set([...requestedCodes, ...preferredCodes, ...availableCodes]))
    .filter((code) => available.has(code))
    .slice(0, 2);
}

/**
 * Returns the latest completed season-index session that can be mapped to a
 * FastF1 artifact directory. The season comparison loader already excludes
 * future sessions, so a positive round is the remaining artifact-path guard.
 */
function artifactSessionCode(sessionCode: string) {
  return sessionCode.toUpperCase() === "SPR" ? "S" : sessionCode.toUpperCase();
}

export function latestFastF1Session(sessions: ComparisonSession[], artifacts: FastF1ArtifactInventoryItem[] = []): ComparisonSession | undefined {
  const published = new Set(artifacts.filter((artifact) => artifact.status === "complete").map((artifact) => `${artifact.round}:${artifactSessionCode(artifact.sessionCode)}`));
  return sessions
    .filter((session) => session.round > 0 && Boolean(session.sessionCode) && published.has(`${session.round}:${artifactSessionCode(session.sessionCode)}`))
    .reduce<ComparisonSession | undefined>((latest, session) => {
      if (!latest) return session;
      const latestAt = Date.parse(latest.startsAt);
      const sessionAt = Date.parse(session.startsAt);
      if (!Number.isFinite(latestAt)) return session;
      if (!Number.isFinite(sessionAt)) return latest;
      return sessionAt >= latestAt ? session : latest;
    }, undefined);
}
