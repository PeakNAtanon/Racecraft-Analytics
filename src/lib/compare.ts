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
export function latestFastF1Session(sessions: ComparisonSession[]): ComparisonSession | undefined {
  return sessions
    .filter((session) => session.round > 0 && Boolean(session.sessionCode))
    .reduce<ComparisonSession | undefined>((latest, session) => {
      if (!latest) return session;
      const latestAt = Date.parse(latest.startsAt);
      const sessionAt = Date.parse(session.startsAt);
      if (!Number.isFinite(latestAt)) return session;
      if (!Number.isFinite(sessionAt)) return latest;
      return sessionAt >= latestAt ? session : latest;
    }, undefined);
}
