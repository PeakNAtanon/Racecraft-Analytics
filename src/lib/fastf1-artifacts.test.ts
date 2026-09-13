import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFastF1ArtifactInventory, getFastF1SessionArtifact, getFastF1DriverTelemetry } from "./fastf1-artifacts";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "racecraft-artifact-test-"));
  vi.stubEnv("TELEMETRY_STORAGE_PATH", root);
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });

async function publish(overrides: Record<string, unknown> = {}, code = "R") {
  const directory = path.join(root, "2026", "2", code);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "session.json"), JSON.stringify({
    provider: "FastF1", schemaVersion: "fastf1-session-v5", status: "complete", season: 2026, round: 2, sessionCode: code,
    pace: { laps: [1, 3], series: [{ code: "VER", values: [90, null] }, { code: "HAM", values: [null, 91] }] }, ...overrides,
  }));
}

it.each([{ schemaVersion: "fastf1-session-v4" }, { schemaVersion: "fastf1-session-v7" }, { round: 1 }, { season: 2025 }, { sessionCode: "Q" }])("rejects stale or mismatched artifacts: %j", async (overrides) => {
  await publish(overrides);
  expect(await getFastF1SessionArtifact({ season: 2026, round: 2, sessionCode: "R" })).toBeNull();
  expect(await getFastF1ArtifactInventory(2026)).toEqual([]);
});

it("preserves v6 distance through both session and driver readers", async () => {
  const samples = [{ timestamp: "00:00:00", distance: -0.1, speed: 100 }, { timestamp: "00:00:01", distance: 30.25, speed: 110 }];
  await publish({ schemaVersion: "fastf1-session-v6", telemetryByDriver: { VER: { available: true, sampleCount: 2, fields: ["speed", "distance"], samples } } });
  const options = { season: 2026, round: 2, sessionCode: "R" };
  expect((await getFastF1SessionArtifact(options))?.telemetryByDriver?.VER.samples).toEqual(samples);
  expect((await getFastF1DriverTelemetry({ ...options, driverCode: "ver" }))?.samples).toEqual(samples);
  expect(await getFastF1ArtifactInventory(2026)).toHaveLength(1);
});

it("keeps v5 time telemetry readable without fabricating distance", async () => {
  const samples = [{ timestamp: "00:00:00", speed: 100 }, { timestamp: "00:00:01", speed: 110 }];
  await publish({ telemetryByDriver: { VER: { available: true, fields: ["speed"], samples } } });
  const trace = (await getFastF1SessionArtifact({ season: 2026, round: 2, sessionCode: "R" }))?.telemetryByDriver?.VER;
  expect(trace?.samples).toEqual(samples);
  expect(trace?.samples.every(sample => sample.distance === undefined)).toBe(true);
});

it("preserves lap-axis alignment and missing values through JSON to chart data", async () => {
  await publish();
  const result = await getFastF1SessionArtifact({ season: 2026, round: 2, sessionCode: "R" });
  expect(result?.pace.laps).toEqual([1, 3]);
  expect(result?.pace.sessionLabel).toContain("2026 · Round 2");
  expect(Number.isFinite(Date.parse(result?.pace.updatedAt ?? ""))).toBe(true);
  expect(result?.pace.series.map(series => series.values)).toEqual([[90, null], [null, 91]]);
});

it("reads a Sprint artifact from S for a public SPR request", async () => {
  await publish({ sessionCode: "SPR" }, "S");
  expect((await getFastF1SessionArtifact({ season: 2026, round: 2, sessionCode: "SPR" }))?.source).toBe("FastF1");
  expect(await getFastF1ArtifactInventory(2026)).toHaveLength(1);
});
