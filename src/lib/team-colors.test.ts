import { describe, expect, it } from "vitest";
import { standings } from "./data";
import { getTeamColor, getTeamMark } from "./team-colors";

describe("team colors", () => {
  it("prefers a validated provider team colour", () => {
    expect(getTeamColor("McLaren", "FF8000")).toBe("#FF8000");
  });

  it("falls back to the team palette when provider colour is absent", () => {
    expect(getTeamColor("Ferrari")).toBe("#e80020");
  });

  it("rejects invalid provider values", () => {
    expect(getTeamColor("Unknown", "red; color: white")).toBe("#a6b0bf");
  });

  it("maps known teams to compact identity marks", () => {
    expect(getTeamMark("McLaren")).toBe("McL");
    expect(getTeamMark("Ferrari")).toBe("FER");
    expect(getTeamMark("Red Bull Racing")).toBe("RBR");
  });

  it("uses a deterministic mark for unknown or empty teams", () => {
    expect(getTeamMark("New Racing Team")).toBe("NRT");
    expect(getTeamMark(undefined)).toBe("TEAM");
  });

  it("provides a non-empty mark for all 22 fallback drivers", () => {
    expect(standings).toHaveLength(22);
    expect(standings.every((driver) => getTeamMark(driver.team).trim().length > 0)).toBe(true);
  });
});
