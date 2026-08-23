import { describe, expect, it } from "vitest";
import { driverHistorySeeds } from "./driver-history";

describe("driver history coverage", () => {
  it("contains stable profile data for all 22 current drivers", () => {
    const profiles = Object.values(driverHistorySeeds);
    expect(profiles).toHaveLength(22);
    expect(new Set(Object.keys(driverHistorySeeds))).toHaveLength(22);
    expect(profiles.every((profile) => profile.driverId && profile.driverNumber > 0 && profile.nationality && profile.dateOfBirth && profile.firstF1Season > 0)).toBe(true);
  });
});
