import type { FastF1ArtifactInventoryItem } from "./fastf1-artifacts";
import type { ComparisonSession } from "./types";

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
