import { describe, expect, it } from "vitest";
import { calculateDriverSummary, selectDriverPaceSeries } from "./driver-analysis";
import type { DriverAnalysisSession } from "./types";

describe("driver pace selection", () => {
  const series = ["ALB", "ALO", "ANT", "BEA", "VER", "HAM"].map(code => ({ code, name: code, values: [90] }));
  it("keeps the selected driver before limiting the field to four", () => {
    expect(selectDriverPaceSeries(series, "VER").map(item => item.code)).toEqual(["VER", "ALB", "ALO", "ANT"]);
  });
  it("selects only the driver and teammate, regardless of source ordering", () => {
    expect(selectDriverPaceSeries(series, "ver", "ham").map(item => item.code)).toEqual(["VER", "HAM"]);
  });
});

const session = (values: Partial<DriverAnalysisSession>): DriverAnalysisSession => ({
  sessionKey: 1,
  round: 1,
  circuit: "Test Circuit",
  sessionCode: "R",
  sessionName: "Race",
  startsAt: "2026-01-01T00:00:00Z",
  status: "complete",
  source: "OpenF1",
  ...values,
});

describe("driver analysis summary", () => {
  it("calculates form and racecraft metrics from classified sessions", () => {
    const result = calculateDriverSummary([
      session({ position: 2, grid: 5, resultStatus: "CLASSIFIED", validLaps: 20 }),
      session({ sessionKey: 2, position: 4, grid: 3, resultStatus: "CLASSIFIED", validLaps: 18 }),
      session({ sessionKey: 3, resultStatus: "DNF" }),
    ]);
    expect(result.averageFinish).toBe(3);
    expect(result.bestFinish).toBe(2);
    expect(result.positionsGained).toBe(2);
    expect(result.validSessions).toBe(2);
    expect(result.validLaps).toBe(38);
    expect(result.classified).toBe(2);
    expect(result.dnf).toBe(1);
  });

  it("keeps missing and non-classified data explicit", () => {
    const result = calculateDriverSummary([
      session({ status: "provisional", resultStatus: "DNS" }),
      session({ sessionKey: 2, status: "unavailable", resultStatus: "DSQ" }),
    ]);
    expect(result.averageFinish).toBeUndefined();
    expect(result.bestFinish).toBeUndefined();
    expect(result.positionsGained).toBeUndefined();
    expect(result.validSessions).toBe(0);
    expect(result.dns).toBe(1);
    expect(result.dsq).toBe(1);
  });

  it("does not count a provider-supplied DNF position as a finish", () => {
    const result = calculateDriverSummary([
      session({ position: 22, grid: 8, resultStatus: "DNF" }),
      session({ sessionKey: 2, position: 4, grid: 6, resultStatus: "CLASSIFIED" }),
    ]);
    expect(result.averageFinish).toBe(4);
    expect(result.validSessions).toBe(1);
    expect(result.positionsGained).toBe(2);
    expect(result.dnf).toBe(1);
  });

  it("uses Race and Sprint sessions for finish and racecraft KPIs", () => {
    const result = calculateDriverSummary([
      session({ position: 1, grid: 4, resultStatus: "CLASSIFIED" }),
      session({ sessionKey: 2, sessionCode: "Q", position: 8, grid: 8, resultStatus: "CLASSIFIED" }),
      session({ sessionKey: 3, sessionCode: "SPR", position: 3, grid: 2, resultStatus: "CLASSIFIED" }),
    ]);
    expect(result.averageFinish).toBe(2);
    expect(result.bestFinish).toBe(1);
    expect(result.positionsGained).toBe(2);
    expect(result.validSessions).toBe(2);
    expect(result.classified).toBe(2);
  });
});
