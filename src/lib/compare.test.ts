import { describe, expect, it } from "vitest";
import { latestFastF1Session, selectDriverPair } from "./compare";
import type { FastF1ArtifactInventoryItem } from "./fastf1-artifacts";
import type { ComparisonSession } from "./types";

function session(overrides: Partial<ComparisonSession>): ComparisonSession {
  return {
    sessionKey: 1,
    round: 1,
    circuit: "Test Circuit",
    sessionCode: "R",
    sessionName: "Race",
    startsAt: "2026-03-01T12:00:00Z",
    results: [],
    ...overrides,
  };
}

function artifact(overrides: Partial<FastF1ArtifactInventoryItem>): FastF1ArtifactInventoryItem {
  return { season: 2026, round: 1, sessionCode: "R", status: "complete", path: "/data/session.json", parquetFiles: 20, ...overrides };
}

describe("Compare FastF1 session selection", () => {
  it("selects the latest session with a published FastF1 artifact", () => {
    const selected = latestFastF1Session([
      session({ sessionKey: 10, round: 1, startsAt: "2026-03-01T12:00:00Z" }),
      session({ sessionKey: 20, round: 2, sessionCode: "Q", startsAt: "2026-03-08T12:00:00Z" }),
      session({ sessionKey: 30, round: 0, startsAt: "2026-03-15T12:00:00Z" }),
    ], [artifact({ round: 1, sessionCode: "R" }), artifact({ round: 2, sessionCode: "Q" })]);

    expect(selected?.sessionKey).toBe(20);
    expect(selected?.round).toBe(2);
    expect(selected?.sessionCode).toBe("Q");
  });

  it("returns undefined when no session can map to a FastF1 artifact", () => {
    expect(latestFastF1Session([session({ round: 1 })], [])).toBeUndefined();
  });

  it("maps the public Sprint code to FastF1's S directory", () => {
    const selected = latestFastF1Session([session({ sessionKey: 12, round: 3, sessionCode: "SPR" })], [artifact({ round: 3, sessionCode: "S" })]);
    expect(selected?.sessionKey).toBe(12);
  });
});

describe("Compare driver pair selection", () => {
  it("keeps requested drivers first and fills a two-driver VS pair", () => {
    expect(selectDriverPair(["ANT", "HAM", "RUS"], ["ANT", "HAM"], ["RUS"])).toEqual(["RUS", "ANT"]);
  });

  it("excludes unknown and duplicate driver codes", () => {
    expect(selectDriverPair(["ANT", "HAM"], ["ANT", "HAM"], ["XXX", "ANT", "ANT"])).toEqual(["ANT", "HAM"]);
  });
});
