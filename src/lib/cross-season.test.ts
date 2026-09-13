import { expect, it } from "vitest";
import { referenceSeasonSessions, seasonDriverStats } from "./cross-season";
import type { ComparisonSession, SessionResult } from "./types";

const session = (round: number, circuit: string, results: SessionResult[] = []): ComparisonSession => ({ round, circuit, results, sessionKey: round, sessionCode: "R", sessionName: "Race", startsAt: "2025-01-01" });

it("matches circuit rather than round number across years", () => {
  const reference = [session(1, "Other"), session(5, "Monza")];
  expect(referenceSeasonSessions([session(1, "Monza")], reference, { round: "1", circuit: "ALL", session: "R" })).toEqual([reference[1]]);
  expect(referenceSeasonSessions([], reference, { round: "1", circuit: "ALL", session: "R" })).toEqual([]);
});

it("keeps missing results, DNS and DNF out of classified averages and does not invent points", () => {
  const results = [{ code: "VER", status: "CLASSIFIED", position: 2, points: 18 }, { code: "VER", status: "DNF", position: 18, points: 0 }, { code: "VER", status: "DNS" }] as SessionResult[];
  const sessions = results.map((result, i) => session(i + 1, "Monza", [result]));
  expect(seasonDriverStats(sessions, "VER")).toEqual({ samples: 3, classified: 1, averagePosition: 2, points: undefined });
  expect(seasonDriverStats(sessions, "HAM").averagePosition).toBeUndefined();
});
