import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DriverRacecraftSnapshot, DriverTelemetrySnapshot, FastF1DriverMetrics, Metric, PaceChartData, SessionAnalyticsSnapshot, StintSnapshot } from "@/lib/types";

type ArtifactMetric = { driver?: string; validLaps?: number; cleanLapMedian?: number; bestLap?: number; consistency?: number | null; degradationSlope?: number | null; theoreticalBest?: number | null };
type Artifact = {
  provider?: string;
  status?: string;
  sessionName?: string;
  sessionCode?: string;
  metrics?: ArtifactMetric[];
  pace?: { laps?: number[]; series?: Array<{ code?: string; name?: string; values?: Array<number | null> }> };
  stints?: Array<{ driver?: string; stint?: number; compound?: string; startLap?: number; endLap?: number; lapCount?: number }>;
  racecraftByDriver?: Record<string, { positionsGained?: number; gridPosition?: number; finishPosition?: number }>;
  telemetryByDriver?: Record<string, { available?: boolean; sampleCount?: number; fields?: string[]; samples?: Array<{ timestamp?: string; speed?: number; throttle?: number; brake?: number; gear?: number }> }>;
};

function artifactRoot() {
  return process.env.TELEMETRY_STORAGE_PATH ?? process.env.FASTF1_ARTIFACTS_DIR;
}

export interface FastF1ArtifactInventoryItem {
  season: number;
  round: number;
  sessionCode: string;
  status: string;
  path: string;
  parquetFiles: number;
}

async function directoryNames(directory: string) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function parquetFileCount(directory: string) {
  try {
    return (await readdir(path.join(directory, "telemetry"))).filter((entry) => entry.endsWith(".parquet")).length;
  } catch {
    return 0;
  }
}

/**
 * Lists artifacts already published by the FastF1 worker.
 * This is deliberately filesystem-only: the web container reads the shared
 * volume and never calls FastF1 or the worker directly.
 */
export async function getFastF1ArtifactInventory(season?: number): Promise<FastF1ArtifactInventoryItem[]> {
  const root = artifactRoot();
  if (!root) return [];
  const seasons = season === undefined ? await directoryNames(root) : [String(season)];
  const inventory: FastF1ArtifactInventoryItem[] = [];
  for (const seasonName of seasons) {
    const seasonNumber = Number(seasonName);
    if (!Number.isInteger(seasonNumber)) continue;
    for (const roundName of await directoryNames(path.join(root, seasonName))) {
      const round = Number(roundName);
      if (!Number.isInteger(round)) continue;
      for (const sessionCode of await directoryNames(path.join(root, seasonName, roundName))) {
        const sessionDirectory = path.join(root, seasonName, roundName, sessionCode);
        const sessionPath = path.join(sessionDirectory, "session.json");
        try {
          const parsed = JSON.parse(await readFile(sessionPath, "utf8")) as Partial<Artifact>;
          if (parsed.provider !== "FastF1") continue;
          inventory.push({
            season: seasonNumber,
            round,
            sessionCode: sessionCode.toUpperCase(),
            status: parsed.status ?? "unknown",
            path: sessionPath,
            parquetFiles: await parquetFileCount(sessionDirectory),
          });
        } catch {
          // A partially written artifact is not exposed in diagnostics.
        }
      }
    }
  }
  return inventory.sort((a, b) => a.season - b.season || a.round - b.round || a.sessionCode.localeCompare(b.sessionCode));
}

async function readArtifact(season: number, round: number | undefined, sessionCode: string | undefined): Promise<Artifact | null> {
  const root = artifactRoot();
  if (!root || round === undefined || !sessionCode) return null;
  const providerSessionCode = sessionCode.toUpperCase() === "SPR" ? "S" : sessionCode.toUpperCase();
  const filename = path.join(root, String(season), String(round), providerSessionCode, "session.json");
  try {
    const parsed: unknown = JSON.parse(await readFile(filename, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const artifact = parsed as Artifact;
    return artifact.provider === "FastF1" && artifact.status === "complete" ? artifact : null;
  } catch {
    return null;
  }
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function metricValue(value: number | undefined, suffix = " s") {
  return value === undefined ? "—" : `${value.toFixed(3)}${suffix}`;
}

function toSnapshot(artifact: Artifact, sessionKey: number | undefined, results: SessionAnalyticsSnapshot["results"], resultsSource: SessionAnalyticsSnapshot["resultsSource"]): SessionAnalyticsSnapshot {
  const metrics = artifact.metrics ?? [];
  const driverMetrics: Record<string, FastF1DriverMetrics> = Object.fromEntries(metrics.flatMap((item) => {
    if (!item.driver) return [];
    return [[item.driver.toUpperCase(), {
      ...(number(item.validLaps) === undefined ? {} : { validLaps: number(item.validLaps) }),
      ...(number(item.cleanLapMedian) === undefined ? {} : { cleanLapMedian: number(item.cleanLapMedian) }),
      ...(number(item.bestLap) === undefined ? {} : { bestLap: number(item.bestLap) }),
      ...(number(item.consistency) === undefined ? {} : { consistency: number(item.consistency) }),
      ...(number(item.degradationSlope) === undefined ? {} : { degradationSlope: number(item.degradationSlope) }),
      ...(number(item.theoreticalBest) === undefined ? {} : { theoreticalBest: number(item.theoreticalBest) }),
    } satisfies FastF1DriverMetrics]];
  }));
  const racecraftByDriver: Record<string, DriverRacecraftSnapshot> = Object.fromEntries(Object.entries(artifact.racecraftByDriver ?? {}).map(([code, item]) => [code.toUpperCase(), {
    source: "FastF1",
    ...(number(item.positionsGained) === undefined ? {} : { positionsGained: number(item.positionsGained) }),
  }]));
  const best = metrics.map(item => number(item.bestLap)).filter((item): item is number => item !== undefined);
  const clean = metrics.map(item => number(item.cleanLapMedian)).filter((item): item is number => item !== undefined);
  const consistency = metrics.map(item => number(item.consistency)).filter((item): item is number => item !== undefined);
  const degradation = metrics.map(item => number(item.degradationSlope)).filter((item): item is number => item !== undefined);
  const fastMetrics: Metric[] = [
    { id: "pace.clean_median", label: "Clean-lap median", value: metricValue(clean.length ? Math.min(...clean) : undefined), note: `${metrics.reduce((total, item) => total + (item.validLaps ?? 0), 0)} valid laps · FastF1`, tone: "cyan" },
    { id: "pace.session_best", label: "Session best lap", value: metricValue(best.length ? Math.min(...best) : undefined), note: "FastF1 validated fastest lap", tone: "green" },
    { id: "pace.consistency", label: "Consistency", value: metricValue(consistency.length ? Math.min(...consistency) : undefined), note: "FastF1 standard deviation", tone: "amber" },
    { id: "tyres.degradation", label: "Tyre degradation", value: metricValue(degradation.length ? Math.min(...degradation) : undefined), note: "FastF1 slope per lap", tone: "red" },
  ];
  const pace: PaceChartData = {
    sessionLabel: `FastF1 · ${artifact.sessionName ?? artifact.sessionCode ?? "Session"}`,
    source: "FastF1",
    laps: artifact.pace?.laps ?? [],
    series: (artifact.pace?.series ?? []).map(item => ({ code: item.code ?? "—", name: item.name ?? item.code ?? "Driver", values: item.values ?? [] })),
    defaultCodes: (artifact.pace?.series ?? []).slice(0, 2).map(item => item.code ?? "—"),
  };
  const stints: StintSnapshot[] = (artifact.stints ?? []).flatMap(item => {
    if (!item.driver || item.startLap === undefined || item.endLap === undefined) return [];
    return [{ driverNumber: 0, code: item.driver, name: item.driver, team: "FastF1", stint: item.stint ?? 0, compound: item.compound ?? "UNKNOWN", startLap: item.startLap, endLap: item.endLap, lapCount: item.lapCount ?? Math.max(0, item.endLap - item.startLap + 1) }];
  });
  return { sessionKey, sessionName: artifact.sessionName ?? artifact.sessionCode ?? "FastF1 session", source: "FastF1", metrics: fastMetrics, driverMetrics, racecraftByDriver, pace, stints, results, resultsSource };
}

export async function getFastF1SessionArtifact(options: { season: number; round?: number; sessionCode?: string; sessionKey?: number; results?: SessionAnalyticsSnapshot["results"]; resultsSource?: SessionAnalyticsSnapshot["resultsSource"] }): Promise<SessionAnalyticsSnapshot | null> {
  const artifact = await readArtifact(options.season, options.round, options.sessionCode);
  return artifact ? toSnapshot(artifact, options.sessionKey, options.results ?? [], options.resultsSource ?? "fallback") : null;
}

export async function getFastF1DriverTelemetry(options: { season: number; round?: number; sessionCode?: string; driverCode: string }): Promise<DriverTelemetrySnapshot | null> {
  const artifact = await readArtifact(options.season, options.round, options.sessionCode);
  const item = artifact?.telemetryByDriver?.[options.driverCode.toUpperCase()];
  if (!item) return null;
  return { available: item.available === true && (item.fields?.length ?? 0) > 0, sampleCount: item.sampleCount ?? item.samples?.length ?? 0, fields: item.fields ?? [], samples: item.samples ?? [], source: "FastF1" };
}
