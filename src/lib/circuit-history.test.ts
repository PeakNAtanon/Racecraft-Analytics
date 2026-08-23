import { describe, expect, it } from "vitest";
import { rounds } from "./data";
import { circuitHistorySeeds } from "./circuit-history";

describe("circuit history coverage", () => {
  it("covers every circuit on the current 23-round calendar", () => {
    expect(rounds).toHaveLength(23);
    expect(Object.keys(circuitHistorySeeds)).toHaveLength(23);
    expect(rounds.every((round) => circuitHistorySeeds[round.slug]?.firstGrandPrix)).toBe(true);
  });
});
