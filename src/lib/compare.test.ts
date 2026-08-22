import { describe, expect, it } from "vitest";
import { latestFastF1Session } from "./compare";
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

describe("Compare FastF1 session selection", () => {
  it("selects the latest completed session with a valid round", () => {
    const selected = latestFastF1Session([
      session({ sessionKey: 10, round: 1, startsAt: "2026-03-01T12:00:00Z" }),
      session({ sessionKey: 20, round: 2, sessionCode: "Q", startsAt: "2026-03-08T12:00:00Z" }),
      session({ sessionKey: 30, round: 0, startsAt: "2026-03-15T12:00:00Z" }),
    ]);

    expect(selected?.sessionKey).toBe(20);
    expect(selected?.round).toBe(2);
    expect(selected?.sessionCode).toBe("Q");
  });

  it("returns undefined when no session can map to a FastF1 artifact", () => {
    expect(latestFastF1Session([session({ round: 0 })])).toBeUndefined();
  });
});
