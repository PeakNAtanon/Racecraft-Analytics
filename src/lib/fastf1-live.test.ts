import { readFile } from "node:fs/promises";
import { afterEach, expect, it, vi } from "vitest";
import { getFastF1ArtifactInventory } from "./fastf1-artifacts";
import { getSessionAnalytics } from "./data-api";
import { distanceTelemetry, elapsedTelemetry } from "./telemetry-chart";
import type { DriverTelemetryPoint, SessionCode } from "./types";

const root = process.env.FASTF1_VALIDATION_ROOT;
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// Explicit opt-in: normal unit tests never download data or require local artifacts.
it.skipIf(!root)("preserves real worker JSON through server data API and telemetry chart mapping", async () => {
  vi.stubEnv("TELEMETRY_STORAGE_PATH", root!);
  const fetch = vi.fn(() => { throw new Error("Artifact reads must not contact providers"); });
  vi.stubGlobal("fetch", fetch);
  const inventory = await getFastF1ArtifactInventory();
  expect(inventory.length).toBeGreaterThan(0);
  for (const item of inventory) {
    const raw = JSON.parse(await readFile(item.path, "utf8"));
    const snapshot = await getSessionAnalytics({ season: item.season, round: item.round, sessionCode: (item.sessionCode === "S" ? "SPR" : item.sessionCode) as SessionCode });
    expect(snapshot.source).toBe("FastF1");
    expect(snapshot.driverAvailability).toEqual(raw.driverAvailability);
    for (const [code, availability] of Object.entries(snapshot.driverAvailability ?? {})) {
      if (availability.status !== "complete") expect(snapshot.telemetryByDriver?.[code]?.available ?? false).toBe(false);
    }
    expect(snapshot.pace.laps).toEqual(raw.pace.laps);
    expect(snapshot.pace.series.length).toBeGreaterThan(0);
    expect(snapshot.pace.series.map(series => series.values)).toEqual(raw.pace.series.map((series: { values: Array<number | null> }) => series.values));
    expect(Number.isFinite(Date.parse(snapshot.pace.updatedAt ?? ""))).toBe(true);
    let traces = 0;
    for (const [code, trace] of Object.entries(snapshot.telemetryByDriver ?? {})) {
      if (!trace.available) continue;
      traces++;
      expect(trace.samples).toEqual(raw.telemetryByDriver[code].samples);
      if (raw.schemaVersion === "fastf1-session-v6") {
        expect(trace.fields).toContain("distance");
        expect(distanceTelemetry(trace.samples)).toEqual(trace.samples);
      }
      const timed = elapsedTelemetry(trace.samples);
      expect(timed.length).toBe(trace.samples.length);
      expect(timed.length).toBeGreaterThan(1);
      expect(timed[0].elapsed).toBe(0);
      expect(timed.at(-1)!.elapsed).toBeGreaterThan(0);
      for (const [index, point] of timed.entries()) {
        if (index) expect(point.elapsed).toBeGreaterThanOrEqual(timed[index - 1].elapsed);
        for (const field of ["speed", "throttle", "brake", "gear", "distance"] as const satisfies ReadonlyArray<keyof DriverTelemetryPoint>) {
          expect(point[field]).toEqual(trace.samples[index][field]);
          if (point[field] !== undefined) expect(Number.isFinite(point[field])).toBe(true);
        }
      }
    }
    expect(traces).toBeGreaterThan(0);
    expect(item.parquetFiles).toBe(traces);
  }
  expect(fetch).not.toHaveBeenCalled();
}, 15000);
