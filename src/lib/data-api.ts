import { fallbackMetrics, getNews, standings as fallbackStandings } from "./data";
import type { Locale } from "./i18n";
import { CircuitStats, ComparisonSession, DriverAnalysisSession, DriverAnalysisSnapshot, DriverProfile, Metric, PaceChartData, Round, SeasonComparisonSnapshot, SessionAnalyticsSnapshot, SessionCode, SessionResult, Standing, StintSnapshot, WeatherSnapshot } from "./types";
import { calculateDriverSummary } from "./driver-analysis";
import { getTeamColor } from "./team-colors";
import { canonicalSessionCode } from "./session-code";
import { getOpenF1PublicationState, type OpenF1PublicationState } from "./openf1-availability";
import { getFastF1ArtifactInventory, getFastF1DriverTelemetry, getFastF1SessionArtifact } from "./fastf1-artifacts";
import { driverHistorySeeds } from "./driver-history";
import { circuitHistorySeed } from "./circuit-history";
import { durationLabel, gapLabel } from "./session-result-format";
import { finiteNumber } from "./number-utils";
import { redisCacheGet, redisCacheKey, redisCacheSet } from "./redis-cache";

type JsonRecord = Record<string, unknown>;
type ApiState = "live" | "unavailable" | "awaiting_data" | "worker" | "not_applicable";

export interface DataCategory {
  id: string;
  label: string;
  description: string;
  provider: string;
  endpoint: string;
  status: ApiState;
  statusLabel: string;
  count: number;
  columns: string[];
  rows: string[][];
}

export interface DataHubSnapshot {
  season: number;
  generatedAt: string;
  openF1PublicationState: OpenF1PublicationState;
  categories: DataCategory[];
}

interface FetchResult {
  ok: boolean;
  data?: unknown;
}

const providerCache = new Map<string, { expiresAt: number; result: FetchResult }>();
const providerInFlight = new Map<string, Promise<FetchResult>>();
const providerQueues = new Map<string, Promise<void>>();
const providerNextRequestAt = new Map<string, number>();

function providerOrigin(url: string) {
  try { return new URL(url).origin; } catch { return "local"; }
}

function providerInterval(origin: string) {
  if (origin.includes("api.openf1.org")) return 400;
  if (origin.includes("api.jolpi.ca")) return 260;
  return 0;
}

function wait(milliseconds: number) {
  return milliseconds > 0 ? new Promise<void>(resolve => setTimeout(resolve, milliseconds)) : Promise.resolve();
}

function queueProviderRequest<T>(url: string, task: () => Promise<T>) {
  const origin = providerOrigin(url);
  const previous = providerQueues.get(origin) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(async () => {
    const interval = providerInterval(origin);
    const delay = Math.max(0, (providerNextRequestAt.get(origin) ?? 0) - Date.now());
    await wait(delay);
    providerNextRequestAt.set(origin, Date.now() + interval);
    return task();
  });
  providerQueues.set(origin, run.then(() => undefined, () => undefined));
  return run;
}

const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown) => value === null || value === undefined ? "—" : String(value);
const nested = (value: unknown, ...keys: string[]) => keys.reduce<unknown>((current, key) => Array.isArray(current) ? current[Number(key)] : record(current)[key], value);
const list = (value: unknown): JsonRecord[] => Array.isArray(value) ? value.map(record) : [];

function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(record);
  const source = record(value);
  const columns = Object.entries(source).filter(([, entry]) => Array.isArray(entry));
  if (!columns.length) return [];
  const length = Math.max(...columns.map(([, entry]) => (entry as unknown[]).length));
  return Array.from({ length }, (_, index) => Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, Array.isArray(entry) ? entry[index] : entry])));
}

async function fetchJson(url: string): Promise<FetchResult> {
  const cached = providerCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const active = providerInFlight.get(url);
  if (active) return active;
  const redisKey = redisCacheKey("provider", url);
  const distributed = await redisCacheGet<FetchResult>(redisKey);
  if (distributed) {
    providerCache.set(url, { expiresAt: Date.now() + 600_000, result: distributed });
    return distributed;
  }

  const request = queueProviderRequest(url, async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": process.env.PROVIDER_USER_AGENT ?? "RacecraftAnalytics/0.1" },
          next: { revalidate: 600 },
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          const result = { ok: true, data: await response.json() };
          providerCache.set(url, { expiresAt: Date.now() + 600000, result });
          void redisCacheSet(redisKey, result, 600);
          return result;
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === 2) return { ok: false };
        const retryAfter = Number(response.headers.get("retry-after"));
        await wait(Number.isFinite(retryAfter) ? Math.min(10000, Math.max(350, retryAfter * 1000)) : 500 * 2 ** attempt);
      } catch {
        if (attempt === 2) return { ok: false };
        await wait(500 * 2 ** attempt);
      }
    }
    return { ok: false };
  });
  providerInFlight.set(url, request);
  try { return await request; } finally { if (providerInFlight.get(url) === request) providerInFlight.delete(url); }
}

function category(input: Omit<DataCategory, "status" | "statusLabel"> & { ok: boolean; worker?: boolean; statusOverride?: ApiState }): DataCategory {
  const status: ApiState = input.statusOverride ?? (input.worker ? "worker" : input.ok ? "live" : "unavailable");
  return {
    ...input,
    status,
    statusLabel: status === "live" ? "API LIVE" : status === "worker" ? "WORKER ARTIFACT" : status === "awaiting_data" ? "POST-SESSION PENDING" : status === "not_applicable" ? "NOT APPLICABLE" : "UNAVAILABLE",
  };
}

function jolpicaRaces(data: unknown) { return list(nested(data, "MRData", "RaceTable", "Races")); }
function jolpicaDrivers(data: unknown) { return list(nested(data, "MRData", "DriverTable", "Drivers")); }
function jolpicaDriverStandings(data: unknown) { return list(nested(data, "MRData", "StandingsTable", "StandingsLists", "0", "DriverStandings")); }
function jolpicaConstructorStandings(data: unknown) { return list(nested(data, "MRData", "StandingsTable", "StandingsLists", "0", "ConstructorStandings")); }

export interface StandingsSnapshot {
  season: number;
  round: number;
  source: "Jolpica" | "fallback";
  complete: boolean;
  standings: Standing[];
  profiles: DriverProfile[];
}

function parseStandings(rows: JsonRecord[]): Standing[] {
  return rows.map((row, index) => {
    const driver = record(row.Driver);
    const constructor = list(row.Constructors)[0] ?? {};
    const givenName = text(driver.givenName);
    const familyName = text(driver.familyName);
    return {
      position: Number(row.position) || index + 1,
      code: text(driver.code),
      name: `${givenName} ${familyName}`.trim(),
      team: text(constructor.name),
      ...(finiteNumber(row.points) === undefined ? {} : { points: finiteNumber(row.points) }),
      ...(finiteNumber(row.wins) === undefined ? {} : { wins: finiteNumber(row.wins) }),
      color: getTeamColor(text(constructor.name)),
    };
  }).filter(driver => driver.code !== "—" && driver.name !== "— —");
}

function parseJolpicaDriver(rows: JsonRecord[], code: string) {
  const row = rows.find((item) => text(item.code).toUpperCase() === code.toUpperCase());
  if (!row) return undefined;
  return {
    driverId: text(row.driverId) === "—" ? undefined : text(row.driverId),
    nationality: text(row.nationality) === "—" ? undefined : text(row.nationality),
    driverNumber: finiteNumber(row.permanentNumber),
    dateOfBirth: text(row.dateOfBirth) === "—" ? undefined : text(row.dateOfBirth),
    profileUrl: text(row.url) === "—" ? undefined : text(row.url).replace(/^http:\/\//, "https://"),
  };
}

export async function getSeasonStandings(season = Number(process.env.F1_SEASON ?? "2026")): Promise<StandingsSnapshot> {
  const jolpica = (process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1").replace(/\/$/, "");
  const [response, driverResponse] = await Promise.all([
    fetchJson(`${jolpica}/${season}/driverstandings.json`),
    fetchJson(`${jolpica}/${season}/drivers.json`),
  ]);
  const rows = parseStandings(jolpicaDriverStandings(response.data));
  const driverRows = jolpicaDrivers(driverResponse.data);
  const round = Number(nested(response.data, "MRData", "StandingsTable", "StandingsLists", "0", "round")) || 0;
  const hasCompleteGrid = rows.length >= fallbackStandings.length;
  const standings = rows.length ? rows : fallbackStandings;
  const profiles = standings.map((standing) => ({
    ...standing,
    ...driverHistorySeeds[standing.code.toUpperCase()],
    ...parseJolpicaDriver(driverRows, standing.code),
  }));
  return {
    season,
    round: rows.length ? round : 0,
    source: rows.length ? "Jolpica" : "fallback",
    complete: hasCompleteGrid,
    standings,
    profiles,
  };
}

const circuitProviderIds: Record<string, string> = {
  "albert-park": "albert_park",
  shanghai: "shanghai",
  suzuka: "suzuka",
  miami: "miami",
  villeneuve: "villeneuve",
  monaco: "monaco",
  catalunya: "catalunya",
  "red-bull-ring": "red_bull_ring",
  silverstone: "silverstone",
  spa: "spa",
  hungaroring: "hungaroring",
  zandvoort: "zandvoort",
  monza: "monza",
  madring: "madrid",
  baku: "baku",
  sepang: "sepang",
  "marina-bay": "marina_bay",
  americas: "americas",
  rodriguez: "rodriguez",
  interlagos: "interlagos",
  vegas: "las_vegas",
  losail: "losail",
  "yas-marina": "yas_marina",
};

function lapSeconds(value: unknown) {
  const parts = text(value).split(":").map(Number);
  if (parts.some(part => !Number.isFinite(part))) return undefined;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

export async function getCircuitStats(round: Round): Promise<CircuitStats> {
  const jolpica = (process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1").replace(/\/$/, "");
  const circuitId = circuitProviderIds[round.circuit.id] ?? round.circuit.id;
  const season = Number(process.env.F1_SEASON ?? "2026");
  const historyResponse = await fetchJson(jolpica + "/circuits/" + encodeURIComponent(circuitId) + "/results.json?limit=1");
  const firstRace = list(nested(historyResponse.data, "MRData", "RaceTable", "Races"))[0];
  const seasonResponses = await Promise.all(
    Array.from({ length: 6 }, (_, index) => season - index).map(year =>
      fetchJson(jolpica + "/" + year + "/circuits/" + encodeURIComponent(circuitId) + "/results.json?limit=100")
    )
  );
  const races = seasonResponses
    .flatMap(response => list(nested(response.data, "MRData", "RaceTable", "Races")))
    .sort((a, b) => Date.parse(text(a.date)) - Date.parse(text(b.date)));
  const latestRace = races.at(-1);
  const latestResults = list(latestRace?.Results);
  const lapValues = latestResults.map(result => finiteNumber(result.laps)).filter((value): value is number => value !== undefined);
  const fastestLap = races.flatMap(race => list(race.Results).flatMap(result => {
    const time = text(nested(result, "FastestLap", "Time", "time"));
    const seconds = lapSeconds(time);
    if (!time || seconds === undefined) return [];
    const driver = record(result.Driver);
    const givenName = text(driver.givenName);
    const familyName = text(driver.familyName);
    return [{ seconds, time, driver: (givenName + " " + familyName).trim(), year: Number(race.season) || undefined }];
  })).sort((a, b) => a.seconds - b.seconds)[0];

  const numberOfLaps = lapValues.length ? Math.max(...lapValues) : undefined;
  if (!historyResponse.ok && !races.length) return { source: "fallback" };
  if (!firstRace && !races.length) return { source: "fallback" };
  return {
    source: "Jolpica",
    firstGrandPrix: Number(firstRace?.season) || Number(races[0]?.season) || undefined,
    numberOfLaps,
    fastestLap: fastestLap ? { time: fastestLap.time, driver: fastestLap.driver, year: fastestLap.year } : undefined,
    raceDistanceKm: numberOfLaps && Number.isFinite(round.circuit.lengthKm) ? Number((numberOfLaps * round.circuit.lengthKm).toFixed(3)) : undefined,
  };
}
export async function getCircuitHistorySummaryBySlug(slug: string): Promise<{ source: "Jolpica" | "reference" | "fallback"; firstGrandPrix?: number; firstRaceName?: string; seasonDebut?: boolean }> {
  const jolpica = (process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1").replace(/\/$/, "");
  const circuitId = circuitProviderIds[slug] ?? slug;
  const seed = circuitHistorySeed(slug);
  const response = await fetchJson(jolpica + "/circuits/" + encodeURIComponent(circuitId) + "/results.json?limit=1");
  const firstRace = list(nested(response.data, "MRData", "RaceTable", "Races"))[0];
  return {
    source: firstRace ? "Jolpica" : seed ? "reference" : "fallback",
    firstGrandPrix: Number(firstRace?.season) || seed?.firstGrandPrix,
    firstRaceName: text(firstRace?.raceName) !== "—" ? text(firstRace?.raceName) : seed?.firstRaceName,
    seasonDebut: seed?.seasonDebut,
  };
}
export async function getCircuitHistorySummariesBySlug(slugs: string[]): Promise<Record<string, { source: "Jolpica" | "reference" | "fallback"; firstGrandPrix?: number; firstRaceName?: string; seasonDebut?: boolean }>> {
  const summaries: Record<string, { source: "Jolpica" | "reference" | "fallback"; firstGrandPrix?: number; firstRaceName?: string; seasonDebut?: boolean }> = {};
  for (let index = 0; index < slugs.length; index += 4) {
    const batch = slugs.slice(index, index + 4);
    const results = await Promise.all(batch.map(async slug => [slug, await getCircuitHistorySummaryBySlug(slug)] as const));
    for (const [slug, summary] of results) summaries[slug] = summary;
  }
  return summaries;
}


function weatherBoolean(value: unknown): boolean | undefined { const normalized = String(value).toLowerCase(); if (value === true || normalized === "true" || normalized === "1") return true; if (value === false || normalized === "false" || normalized === "0") return false; return undefined }

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function lapTime(value: number | undefined) {
  if (value === undefined) return "—";
  const minutes = Math.floor(value / 60);
  const seconds = (value - minutes * 60).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}

function isTrue(value: unknown) {
  return value === true || String(value).toLowerCase() === "true";
}

function resultStatus(row: JsonRecord) {
  if (isTrue(row.dsq)) return "DSQ" as const;
  if (isTrue(row.dns)) return "DNS" as const;
  if (isTrue(row.dnf)) return "DNF" as const;
  return "CLASSIFIED" as const;
}

type DriverInfo = { code: string; name: string; team: string; color?: string };

function driverInfoMap(rows: JsonRecord[]) {
  const drivers = new Map<number, DriverInfo>();
  for (const row of rows) {
    const number = finiteNumber(row.driver_number);
    if (number === undefined) continue;
    const firstName = text(row.first_name);
    const lastName = text(row.last_name);
    const name = firstName !== "—" && lastName !== "—" ? `${firstName} ${lastName}` : text(row.full_name);
    drivers.set(number, { code: text(row.name_acronym), name, team: text(row.team_name), color: typeof row.team_colour === "string" ? row.team_colour : undefined });
  }
  return drivers;
}

function parseOpenF1Results(data: unknown, drivers: Map<number, DriverInfo>): SessionResult[] {
  return records(data)
    .flatMap(row => {
      const driverNumber = finiteNumber(row.driver_number);
      if (driverNumber === undefined) return [];
      const info = drivers.get(driverNumber) ?? { code: `#${driverNumber}`, name: `Driver ${driverNumber}`, team: "OpenF1" };
      const laps = finiteNumber(row.number_of_laps);
      const position = finiteNumber(row.position);
      return [{
        ...(position === undefined ? {} : { position }),
        driverNumber,
        ...info,
        status: resultStatus(row),
        time: durationLabel(row.duration),
        gap: gapLabel(row.gap_to_leader),
        ...(laps === undefined ? {} : { laps }),
        ...(finiteNumber(row.grid_position) === undefined ? {} : { grid: finiteNumber(row.grid_position) }),
        ...(finiteNumber(row.points) === undefined ? {} : { points: finiteNumber(row.points) }),
      }];
    })
    .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
}

function raceDate(row: JsonRecord) {
  const date = text(row.date);
  const time = text(row.time).replace("—", "00:00:00Z");
  const value = /[zZ]|[+-]\d{2}:?\d{2}$/.test(time) ? `${date}T${time}` : `${date}T${time}Z`;
  return Date.parse(value);
}

async function mapWithConcurrency<T, U>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<U>) {
  const output = new Array<U>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

function jolpicaResultStatus(value: unknown) {
  const status = text(value).toLowerCase();
  if (status.includes("disqual")) return "DSQ" as const;
  if (status.includes("did not start") || status === "dns") return "DNS" as const;
  if (status === "finished" || status === "lapped" || status.includes("+")) return "CLASSIFIED" as const;
  return "DNF" as const;
}

function parseJolpicaRaceResults(data: unknown): SessionResult[] {
  return list(nested(data, "MRData", "RaceTable", "Races", "0", "Results"))
    .flatMap(row => {
      const driverNumber = finiteNumber(row.number);
      if (driverNumber === undefined) return [];
      const position = finiteNumber(row.position);
      const time = text(nested(row, "Time", "time"));
      const laps = finiteNumber(row.laps);
      return [{
        ...(position === undefined ? {} : { position }),
        driverNumber,
        code: text(nested(row, "Driver", "code")) === "—" ? `#${driverNumber}` : text(nested(row, "Driver", "code")),
        name: `${text(nested(row, "Driver", "givenName"))} ${text(nested(row, "Driver", "familyName"))}`.trim(),
        team: text(nested(row, "Constructor", "name")),
        status: jolpicaResultStatus(row.status),
        time: position === 1 ? time : "—",
        gap: position === 1 ? "LEADER" : time,
        ...(laps === undefined ? {} : { laps }),
        ...(finiteNumber(row.grid) === undefined ? {} : { grid: finiteNumber(row.grid) }),
        ...(finiteNumber(row.points) === undefined ? {} : { points: finiteNumber(row.points) }),
      }];
    })
    .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
}

function parseJolpicaSessionResults(data: unknown, resultKey: "QualifyingResults" | "SprintResults"): SessionResult[] {
  return list(nested(data, "MRData", "RaceTable", "Races", "0", resultKey))
    .flatMap(row => {
      const driverNumber = finiteNumber(row.number);
      if (driverNumber === undefined) return [];
      const duration = [row.Q3, row.Q2, row.Q1].map(text).find(value => value !== "—") ?? "—";
      return [{
        ...(finiteNumber(row.position) === undefined ? {} : { position: finiteNumber(row.position) }),
        driverNumber,
        code: text(nested(row, "Driver", "code")) === "—" ? `#${driverNumber}` : text(nested(row, "Driver", "code")),
        name: `${text(nested(row, "Driver", "givenName"))} ${text(nested(row, "Driver", "familyName"))}`.trim(),
        team: text(nested(row, "Constructor", "name")),
        status: "CLASSIFIED" as const,
        time: duration,
        gap: "—",
        ...(finiteNumber(row.grid) === undefined ? {} : { grid: finiteNumber(row.grid) }),
        ...(finiteNumber(row.points) === undefined ? {} : { points: finiteNumber(row.points) }),
      }];
    })
    .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
}

function jolpicaSessionEndpoint(code: SessionCode) {
  if (code === "R") return "results";
  if (code === "Q") return "qualifying";
  if (code === "SPR") return "sprint";
  return undefined;
}

function parseJolpicaResultsForCode(data: unknown, code: SessionCode): SessionResult[] {
  if (code === "R") return parseJolpicaRaceResults(data);
  if (code === "Q") return parseJolpicaSessionResults(data, "QualifyingResults");
  if (code === "SPR") return parseJolpicaSessionResults(data, "SprintResults");
  return [];
}

function mergeResultMetadata(results: SessionResult[], supplemental: SessionResult[]) {
  const byNumber = new Map(supplemental.map(result => [result.driverNumber, result]));
  const byCode = new Map(supplemental.map(result => [result.code.toUpperCase(), result]));
  return results.map(result => {
    const extra = byNumber.get(result.driverNumber) ?? byCode.get(result.code.toUpperCase());
    if (!extra) return result;
    return {
      ...result,
      ...(result.grid === undefined && extra.grid !== undefined ? { grid: extra.grid } : {}),
      ...(result.points === undefined && extra.points !== undefined ? { points: extra.points } : {}),
      ...(result.laps === undefined && extra.laps !== undefined ? { laps: extra.laps } : {}),
    };
  });
}

function isPitOutLap(value: unknown) {
  return value === true || String(value).toLowerCase() === "true";
}

function fallbackSessionAnalytics(sessionKey?: number, sessionName = "Session data unavailable", results: SessionResult[] = [], resultsSource: "OpenF1" | "Jolpica" | "fallback" = "fallback", weather?: WeatherSnapshot): SessionAnalyticsSnapshot {
  return {
    sessionKey,
    sessionName,
    source: "fallback",
    metrics: fallbackMetrics,
    pace: { sessionLabel: `FastF1 pending · ${sessionName}`, source: "fallback", laps: [], series: [] },
    stints: [],
    results,
    resultsSource,
    ...(weather ? { weather } : {}),
  };
}

export async function getSessionAnalytics(options: { sessionKey?: number; season?: number; round?: number; sessionCode?: SessionCode; sessionName?: string; driverNumber?: number; driverCodes?: string[]; includeStints?: boolean; fastF1Only?: boolean } = {}): Promise<SessionAnalyticsSnapshot> {
  const season = options.season ?? Number(process.env.F1_SEASON ?? "2026");
  const openf1 = (process.env.OPENF1_BASE_URL ?? "https://api.openf1.org/v1").replace(/\/$/, "");
  const fastF1Only = options.fastF1Only ?? true;
  let sessionKey = options.sessionKey;
  let sessionName = options.sessionName ?? "Latest completed session";

  if (!sessionKey && !options.sessionName) {
    const sessions = await fetchJson(`${openf1}/sessions?year=${season}`);
    const sessionRows = records(sessions.data)
      .filter(row => Date.parse(text(row.date_start)) <= Date.now())
      .sort((a, b) => Date.parse(text(b.date_start)) - Date.parse(text(a.date_start)));
    sessionKey = finiteNumber(sessionRows[0]?.session_key);
    sessionName = text(sessionRows[0]?.session_name) === "—" ? sessionName : text(sessionRows[0]?.session_name);
  }

  const selectedSessionCode = options.sessionCode ?? canonicalSessionCode(sessionName);
  const latestPublishedArtifact = options.round === undefined
    ? (await getFastF1ArtifactInventory(season)).filter(item => item.sessionCode === (selectedSessionCode === "SPR" ? "S" : selectedSessionCode)).at(-1)
    : undefined;
  const fastF1Artifact = await getFastF1SessionArtifact({ season, round: options.round ?? latestPublishedArtifact?.round, sessionCode: selectedSessionCode, sessionKey });
  if (!sessionKey && fastF1Artifact) return fastF1Artifact;
  if (!sessionKey) return fallbackSessionAnalytics(undefined, sessionName);

  const [drivers, weather, sessionResult] = await Promise.all([
    fetchJson(`${openf1}/drivers?session_key=${encodeURIComponent(sessionKey)}`),
    fetchJson(`${openf1}/weather?session_key=${encodeURIComponent(sessionKey)}`),
    fetchJson(`${openf1}/session_result?session_key=${encodeURIComponent(sessionKey)}`),
  ]);
  const driverRows = records(drivers.data);

  const driverMap = driverInfoMap(driverRows);

  let results = parseOpenF1Results(sessionResult.data, driverMap);
  let resultsSource: "OpenF1" | "Jolpica" | "fallback" = results.length ? "OpenF1" : "fallback";
  if (!results.length && options.round !== undefined && selectedSessionCode) {
    const jolpica = (process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1").replace(/\/$/, "");
    const endpoint = jolpicaSessionEndpoint(selectedSessionCode);
    const response = endpoint ? await fetchJson(`${jolpica}/${season}/${options.round}/${endpoint}.json`) : { ok: false };
    results = parseJolpicaResultsForCode(response.data, selectedSessionCode);
    resultsSource = results.length ? "Jolpica" : "fallback";
  } else if (!results.length && selectedSessionCode === "R" && options.sessionKey === undefined) {
    const jolpica = (process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1").replace(/\/$/, "");
    results = parseJolpicaRaceResults((await fetchJson(`${jolpica}/current/last/results.json`)).data);
    resultsSource = results.length ? "Jolpica" : "fallback";
  }

  const latestOpenF1Weather = records(weather.data).sort((a, b) => Date.parse(text(a.date)) - Date.parse(text(b.date))).at(-1);
  const openF1Weather: WeatherSnapshot | undefined = latestOpenF1Weather && Object.keys(latestOpenF1Weather).length ? { source: "OpenF1", sessionName, sampledAt: typeof latestOpenF1Weather.date === "string" ? latestOpenF1Weather.date : undefined, airTemperature: finiteNumber(latestOpenF1Weather.air_temperature), trackTemperature: finiteNumber(latestOpenF1Weather.track_temperature), humidity: finiteNumber(latestOpenF1Weather.humidity), windSpeed: finiteNumber(latestOpenF1Weather.wind_speed), windDirection: finiteNumber(latestOpenF1Weather.wind_direction), rainfall: weatherBoolean(latestOpenF1Weather.rainfall) } : undefined;
  if (fastF1Artifact) return { ...fastF1Artifact, sessionKey, sessionName: fastF1Artifact.sessionName || sessionName, results, resultsSource, ...(fastF1Artifact.weather ? {} : openF1Weather ? { weather: openF1Weather } : {}) };
  if (fastF1Only) return fallbackSessionAnalytics(sessionKey, sessionName, results, resultsSource, openF1Weather);

  const [laps, pits] = await Promise.all([
    fetchJson(`${openf1}/laps?session_key=${encodeURIComponent(sessionKey)}`),
    fetchJson(`${openf1}/pit?session_key=${encodeURIComponent(sessionKey)}`),
  ]);
  const lapRows = records(laps.data);
  if (!laps.ok || !lapRows.length) return fallbackSessionAnalytics(sessionKey, sessionName, results, resultsSource);

  const validLaps = lapRows.flatMap(row => {
    const driverNumber = finiteNumber(row.driver_number);
    const lapNumber = finiteNumber(row.lap_number);
    const duration = finiteNumber(row.lap_duration);
    if (driverNumber === undefined || lapNumber === undefined || duration === undefined || duration < 40 || duration > 180 || isPitOutLap(row.is_pit_out_lap)) return [];
    return [{ driverNumber, lapNumber, duration }];
  });
  if (!validLaps.length) return fallbackSessionAnalytics(sessionKey, sessionName, results, resultsSource);

  const byDriver = new Map<number, Array<{ lapNumber: number; duration: number }>>();
  for (const lap of validLaps) byDriver.set(lap.driverNumber, [...(byDriver.get(lap.driverNumber) ?? []), { lapNumber: lap.lapNumber, duration: lap.duration }]);
  const driverStats = [...byDriver.entries()].map(([driverNumber, samples]) => {
    const info = driverMap.get(driverNumber) ?? { code: `#${driverNumber}`, name: `Driver ${driverNumber}`, team: "OpenF1" };
    const best = samples.reduce((current, sample) => sample.duration < current.duration ? sample : current, samples[0]);
    return { driverNumber, ...info, samples, median: median(samples.map(sample => sample.duration)) ?? best.duration, best };
  }).sort((a, b) => a.median - b.median);
  const chartLaps = [...new Set(validLaps.map(lap => lap.lapNumber))].sort((a, b) => a - b).slice(0, 24);
  const series = driverStats.map(driver => {
    const byLap = new Map(driver.samples.map(sample => [sample.lapNumber, sample.duration]));
    return { code: driver.code, name: driver.name, color: getTeamColor(driver.team, driver.color), values: chartLaps.map(lap => byLap.get(lap) ?? null) };
  });

  const selectedStintDrivers = options.driverCodes?.length
    ? [...driverMap.entries()].filter(([, info]) => options.driverCodes?.includes(info.code.toUpperCase())).map(([number]) => number)
    : [...driverMap.keys()].slice(0, 4);
  const stintDrivers = options.driverNumber !== undefined ? [options.driverNumber] : options.includeStints ? selectedStintDrivers : [];
  const stintResponses = await mapWithConcurrency(stintDrivers, 6, async driverNumber => ({ driverNumber, response: await fetchJson(`${openf1}/stints?session_key=${encodeURIComponent(sessionKey)}&driver_number=${driverNumber}`) }));
  const stints = stintResponses.flatMap(({ driverNumber, response }) => {
    const info = driverMap.get(driverNumber) ?? { code: `#${driverNumber}`, name: `Driver ${driverNumber}`, team: "OpenF1" };
    return records(response.data).flatMap(row => {
      const stint = finiteNumber(row.stint_number);
      const startLap = finiteNumber(row.lap_start);
      const endLap = finiteNumber(row.lap_end);
      if (stint === undefined || startLap === undefined || endLap === undefined || endLap < startLap) return [];
      const samples = validLaps.filter(lap => lap.driverNumber === driverNumber && lap.lapNumber >= startLap && lap.lapNumber <= endLap).sort((a, b) => a.lapNumber - b.lapNumber);
      const values = samples.map(sample => sample.duration);
      const quarter = Math.max(1, Math.floor(values.length / 4));
      const earlyMedian = median(values.slice(0, quarter));
      const lateMedian = median(values.slice(-quarter));
      const snapshot: StintSnapshot = {
        driverNumber,
        code: info.code,
        name: info.name,
        team: info.team,
        color: getTeamColor(info.team, info.color),
        stint,
        compound: text(row.compound),
        startLap,
        endLap,
        lapCount: Math.max(0, endLap - startLap + 1),
        ...(median(values) === undefined ? {} : { medianLap: median(values) }),
        ...(earlyMedian !== undefined && lateMedian !== undefined ? { degradationPerLap: (lateMedian - earlyMedian) / Math.max(1, endLap - startLap) } : {}),
      };
      return [snapshot];
    });
  }).sort((a, b) => a.code.localeCompare(b.code) || a.stint - b.stint);

  const pitDurations = records(pits.data).flatMap(row => {
    const duration = finiteNumber(row.pit_duration);
    return duration !== undefined && duration > 0 && duration < 120 ? [duration] : [];
  });
  const weatherRows = records(weather.data).sort((a, b) => Date.parse(text(a.date)) - Date.parse(text(b.date)));
  const latestWeather = weatherRows.at(-1);
  const cleanMedian = median(validLaps.map(lap => lap.duration));
  const bestDriver = driverStats.reduce((current, driver) => driver.best.duration < current.best.duration ? driver : current, driverStats[0]);
  const trackTemperature = finiteNumber(latestWeather?.track_temperature);
  const weatherSnapshot: WeatherSnapshot | undefined = latestWeather && Object.keys(latestWeather).length ? { source: "OpenF1", sessionName, sampledAt: typeof latestWeather.date === "string" ? latestWeather.date : undefined, airTemperature: finiteNumber(latestWeather.air_temperature), trackTemperature, humidity: finiteNumber(latestWeather.humidity), windSpeed: finiteNumber(latestWeather.wind_speed), windDirection: finiteNumber(latestWeather.wind_direction), rainfall: weatherBoolean(latestWeather.rainfall) } : undefined;
  const metrics: Metric[] = [
    { id: "pace.clean_median", label: "Clean-lap median", value: lapTime(cleanMedian), note: `${validLaps.length} laps · OpenF1`, tone: "cyan" },
    { id: "pace.session_best", label: "Session best lap", value: lapTime(bestDriver.best.duration), note: `${bestDriver.code} · Lap ${bestDriver.best.lapNumber}`, tone: "green" },
    { id: "strategy.pit_lane", label: "Pit-lane duration", value: pitDurations.length ? `${(median(pitDurations) ?? 0).toFixed(1)} s` : "—", note: `${pitDurations.length} recorded stops · OpenF1`, tone: "red" },
    { id: "weather.track_temp", label: "Track temperature", value: trackTemperature === undefined ? "—" : `${trackTemperature.toFixed(1)} °C`, note: latestWeather ? "latest OpenF1 weather sample" : "weather sample unavailable", tone: "amber" },
  ];
  const pace: PaceChartData = { sessionLabel: `OpenF1 · ${sessionName}`, source: "OpenF1", laps: chartLaps, series, defaultCodes: driverStats.slice(0, 2).map(driver => driver.code) };
  return { sessionKey, sessionName, source: "OpenF1", metrics, pace, stints, results, resultsSource, weather: weatherSnapshot };
}

const seasonComparisonCache = new Map<string, { expiresAt: number; request: Promise<SeasonComparisonSnapshot> }>();
const comparisonCacheVersion = "provider-adapter-v4";

async function loadSeasonComparison(season: number): Promise<SeasonComparisonSnapshot> {
  const openf1 = (process.env.OPENF1_BASE_URL ?? "https://api.openf1.org/v1").replace(/\/$/, "");
  const jolpica = (process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1").replace(/\/$/, "");
  const [sessionsResponse, calendarResponse, standingsSnapshot] = await Promise.all([
    fetchJson(`${openf1}/sessions?year=${season}`),
    fetchJson(`${jolpica}/${season}.json`),
    getSeasonStandings(season),
  ]);
  const races = jolpicaRaces(calendarResponse.data);
  const raceRows = races.map(row => ({ row, at: raceDate(row) })).filter(item => Number.isFinite(item.at));
  const sessionRows = records(sessionsResponse.data)
    .flatMap(row => {
      const sessionKey = finiteNumber(row.session_key);
      const code = canonicalSessionCode(row.session_name ?? row.session_type);
      const startsAt = text(row.date_start);
      const start = Date.parse(startsAt);
      const end = Date.parse(text(row.date_end));
      if (sessionKey === undefined || isTrue(row.is_cancelled) || !code || !startsAt || !Number.isFinite(start) || start > Date.now() || (Number.isFinite(end) && end > Date.now())) return [];
      return [{ row, sessionKey, code, startsAt, start }];
    })
    .sort((a, b) => a.start - b.start);

  const latest = sessionRows.at(-1);
  const driverResponse = latest ? await fetchJson(`${openf1}/drivers?session_key=${latest.sessionKey}`) : { ok: false };
  const drivers = driverInfoMap(records(driverResponse.data));
  const sessions = await mapWithConcurrency(sessionRows, 12, async session => {
    // Keep the season index within the public OpenF1 request budget while
    // retaining a result status for every completed session. Jolpica remains
    // the authoritative supplement for Race, Qualifying and Sprint fields;
    // OpenF1 supplies the session result when Jolpica has no equivalent.
    let closest: { row: JsonRecord; at: number; distance: number } | undefined;
    for (const candidate of raceRows) {
      const distance = Math.abs(candidate.at - session.start);
      if (!closest || distance < closest.distance) closest = { ...candidate, distance };
    }
    const round = closest && closest.distance <= 7 * 86400000 ? Number(closest.row.round) || 0 : 0;
    const endpoint = jolpicaSessionEndpoint(session.code);
    const jolpicaResponse = endpoint && round > 0
      ? await fetchJson(`${jolpica}/${season}/${round}/${endpoint}.json`)
      : { ok: false, data: undefined } satisfies FetchResult;
    const jolpicaResults = endpoint ? parseJolpicaResultsForCode(jolpicaResponse.data, session.code) : [];
    let resultRows = jolpicaResults;
    let resultsSource: ComparisonSession["resultsSource"] = jolpicaResults.length ? "Jolpica" : "fallback";
    // OpenF1 is the only source used for Practice and Sprint Qualifying in the
    // season index. It is also a provider fallback when a Jolpica result is
    // unavailable, so a partial upstream failure does not erase the session.
    if (!resultRows.length || !endpoint) {
      const resultResponse = await fetchJson(`${openf1}/session_result?session_key=${encodeURIComponent(session.sessionKey)}`);
      const openF1Results = parseOpenF1Results(resultResponse.data, drivers);
      if (openF1Results.length) {
        resultRows = jolpicaResults.length ? mergeResultMetadata(openF1Results, jolpicaResults) : openF1Results;
        resultsSource = jolpicaResults.length ? "Jolpica" : "OpenF1";
      }
    }
    const circuit = text(session.row.circuit_short_name) !== "—" ? text(session.row.circuit_short_name) : text(session.row.location);
    return {
      sessionKey: session.sessionKey,
      round,
      circuit: circuit === "—" ? "Circuit unavailable" : circuit,
      sessionCode: session.code,
      sessionName: text(session.row.session_name),
      startsAt: session.startsAt,
      results: resultRows,
      resultsSource,
    } satisfies ComparisonSession;
  });

  const colorByCode = new Map([...drivers.values()].map(driver => [driver.code, driver.color]));
  return {
    season,
    source: standingsSnapshot.source === "Jolpica" ? "Jolpica" : sessionsResponse.ok ? "OpenF1" : "fallback",
    drivers: standingsSnapshot.standings.map(driver => ({ ...driver, color: getTeamColor(driver.team, colorByCode.get(driver.code)) })),
    sessions,
  };
}

export async function getSeasonComparison(season = Number(process.env.F1_SEASON ?? "2026")): Promise<SeasonComparisonSnapshot> {
  const cacheKey = `${comparisonCacheVersion}:${season}`;
  const cached = seasonComparisonCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.request;
  if (cached) seasonComparisonCache.delete(cacheKey);
  const request = loadSeasonComparison(season).catch((error) => {
    seasonComparisonCache.delete(cacheKey);
    throw error;
  });
  seasonComparisonCache.set(cacheKey, { expiresAt: Date.now() + 600_000, request });
  return request;
}

export interface DriverAnalysisOptions {
  season?: number;
  code: string;
  sessionKey?: number;
  round?: number;
  circuit?: string;
  sessionCode?: SessionCode;
}

export async function getDriverAnalysis(options: DriverAnalysisOptions): Promise<DriverAnalysisSnapshot | null> {
  const season = options.season ?? Number(process.env.F1_SEASON ?? "2026");
  const code = options.code.trim().toUpperCase();
  const jolpica = (process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1").replace(/\/$/, "");
  const [comparison, driverResponse] = await Promise.all([
    getSeasonComparison(season),
    fetchJson(`${jolpica}/${season}/drivers.json`),
  ]);
  const standing = comparison.drivers.find((driver) => driver.code.toUpperCase() === code);
  if (!standing) return null;

  const profile: DriverProfile = { ...standing, ...driverHistorySeeds[code], ...parseJolpicaDriver(jolpicaDrivers(driverResponse.data), code) };
  const sessions: DriverAnalysisSession[] = comparison.sessions.map((session) => {
    const result = session.results.find((item) => item.code.toUpperCase() === code);
    const started = Date.parse(session.startsAt) <= Date.now();
    return {
      sessionKey: session.sessionKey,
      round: session.round,
      circuit: session.circuit,
      sessionCode: session.sessionCode,
      sessionName: session.sessionName,
      startsAt: session.startsAt,
      status: result ? "complete" : started ? "provisional" : "unavailable",
      ...(result?.position === undefined ? {} : { position: result.position }),
      ...(result?.grid === undefined ? {} : { grid: result.grid }),
      ...(result?.points === undefined ? {} : { points: result.points }),
      ...(result?.laps === undefined ? {} : { laps: result.laps }),
      ...(result?.status === undefined ? {} : { resultStatus: result.status }),
      source: result ? session.resultsSource ?? "OpenF1" : "fallback",
    };
  });

  const filtered = sessions.filter((session) =>
    (options.sessionCode === undefined || session.sessionCode === options.sessionCode) &&
    (options.round === undefined || session.round === options.round) &&
    (options.circuit === undefined || session.circuit === options.circuit)
  );
  const hasExplicitSessionFilter = options.sessionKey !== undefined || options.round !== undefined || options.circuit !== undefined || options.sessionCode !== undefined;
  const publishedArtifacts = hasExplicitSessionFilter ? [] : await getFastF1ArtifactInventory(season);
  const latestPublishedSession = filtered.filter((session) => publishedArtifacts.some((artifact) => artifact.round === session.round && artifact.sessionCode === (session.sessionCode === "SPR" ? "S" : session.sessionCode))).at(-1);
  const selectedSession = filtered.find((session) => session.sessionKey === options.sessionKey) ?? latestPublishedSession ?? filtered.filter((session) => session.status === "complete").at(-1) ?? filtered.at(-1);
  const selectedDriverNumber = profile.driverNumber;
  const selectedAnalytics = selectedSession
    ? await getSessionAnalytics({ sessionKey: selectedSession.sessionKey, season, round: selectedSession.round || undefined, sessionCode: selectedSession.sessionCode, sessionName: selectedSession.sessionName, driverNumber: selectedDriverNumber, fastF1Only: true })
    : undefined;
  const fastF1Telemetry = selectedSession ? await getFastF1DriverTelemetry({ season, round: selectedSession.round, sessionCode: selectedSession.sessionCode, driverCode: code }) : null;
  const fastF1Racecraft = selectedAnalytics?.source === "FastF1" ? selectedAnalytics.racecraftByDriver?.[code] : undefined;
  if (selectedSession && selectedAnalytics) {
    const selectedResult = selectedAnalytics.results.find((result) => result.code.toUpperCase() === code);
    if (selectedResult) {
      selectedSession.status = "complete";
      selectedSession.source = selectedAnalytics.resultsSource;
      if (selectedResult.position !== undefined) selectedSession.position = selectedResult.position;
      if (selectedResult.grid !== undefined) selectedSession.grid = selectedResult.grid;
      if (selectedResult.points !== undefined) selectedSession.points = selectedResult.points;
      if (selectedResult.laps !== undefined) selectedSession.laps = selectedResult.laps;
      selectedSession.resultStatus = selectedResult.status;
    }
    const validLaps = selectedAnalytics.pace.series.find((series) => series.code.toUpperCase() === code)?.values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).length ?? 0;
    selectedSession.validLaps = validLaps;
  }

  return {
    season,
    driver: profile,
    source: selectedAnalytics?.source === "FastF1" ? "FastF1" : "fallback",
    status: !sessions.length ? "awaiting_data" : selectedSession?.status === "complete" && selectedAnalytics?.source === "FastF1" ? "complete" : "provisional",
    sessions,
    summary: calculateDriverSummary(sessions),
    ...(selectedSession ? { selectedSession } : {}),
    ...(selectedAnalytics ? { selectedAnalytics } : {}),
    ...(fastF1Racecraft ? { racecraft: fastF1Racecraft } : {}),
    ...(fastF1Telemetry ? { telemetry: fastF1Telemetry } : {}),
    teammate: comparison.drivers.find((driver) => driver.team === standing.team && driver.code !== standing.code),
  };
}

function dateLabel(value: unknown, locale: Locale, timezone = "Asia/Bangkok") {
  if (!value) return "—";
  const date = new Date(String(value));
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  return Number.isNaN(date.getTime()) ? text(value) : new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(date);
}

const dataHubCache = new Map<string, { expiresAt: number; value: DataHubSnapshot }>();
const dataHubInFlight = new Map<string, Promise<DataHubSnapshot>>();

async function loadDataHub(timezone: string, locale: Locale): Promise<DataHubSnapshot> {
  const season = Number(process.env.F1_SEASON ?? "2026");
  const jolpica = (process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1").replace(/\/$/, "");
  const openf1 = (process.env.OPENF1_BASE_URL ?? "https://api.openf1.org/v1").replace(/\/$/, "");
  const [calendar, drivers, driverStandings, constructorStandings, results, pitStops, sessions, news] = await Promise.all([
    fetchJson(`${jolpica}/${season}.json`),
    fetchJson(`${jolpica}/${season}/drivers.json`),
    fetchJson(`${jolpica}/${season}/driverstandings.json`),
    fetchJson(`${jolpica}/${season}/constructorstandings.json`),
    fetchJson(`${jolpica}/current/last/results.json`),
    fetchJson(`${jolpica}/current/last/pitstops.json`),
    fetchJson(`${openf1}/sessions?year=${season}`),
    getNews().catch(() => []),
  ]);

  const sessionRecords = records(sessions.data);
  const sortedSessions = [...sessionRecords].sort((a, b) => Date.parse(text(b.date_start)) - Date.parse(text(a.date_start)));
  const latestSession = sortedSessions.find(session => Date.parse(text(session.date_start)) <= Date.now()) ?? sortedSessions[0];
  const sessionRows = latestSession ? [latestSession, ...sortedSessions.filter((session) => session !== latestSession)] : sortedSessions;
  const openF1PublicationState = getOpenF1PublicationState(text(latestSession?.date_start) || undefined, text(latestSession?.date_end) || undefined);
  const openF1Status = (ok: boolean): ApiState | undefined => ok ? undefined : "awaiting_data";
  const latestSessionCode = canonicalSessionCode(latestSession?.session_name ?? latestSession?.session_type);
  const sessionKey = text(latestSession?.session_key);
  const [weather, laps, stints, openf1PitStops, raceControl, overtakes] = sessionKey !== "—" ? await Promise.all([
    fetchJson(`${openf1}/weather?session_key=${encodeURIComponent(sessionKey)}`),
    fetchJson(`${openf1}/laps?session_key=${encodeURIComponent(sessionKey)}`),
    fetchJson(`${openf1}/stints?session_key=${encodeURIComponent(sessionKey)}`),
    fetchJson(`${openf1}/pit?session_key=${encodeURIComponent(sessionKey)}`),
    fetchJson(`${openf1}/race_control?session_key=${encodeURIComponent(sessionKey)}`),
    fetchJson(`${openf1}/overtakes?session_key=${encodeURIComponent(sessionKey)}`),
  ]) : [{ ok: false }, { ok: false }, { ok: false }, { ok: false }, { ok: false }, { ok: false }];
  const formatDate = (value: unknown) => dateLabel(value, locale, timezone);

  const races = jolpicaRaces(calendar.data);
  const driverRows = jolpicaDrivers(drivers.data);
  const driverStandingRows = jolpicaDriverStandings(driverStandings.data);
  const constructorRows = jolpicaConstructorStandings(constructorStandings.data);
  const resultRows = list(nested(results.data, "MRData", "RaceTable", "Races", "0", "Results"));
  const pitStopRows = list(nested(pitStops.data, "MRData", "RaceTable", "Races", "0", "PitStops"));
  const weatherRows = records(weather.data);
  const lapRows = records(laps.data);
  const stintRows = records(stints.data);
  const openf1PitStopRows = records(openf1PitStops.data);
  const raceControlRows = records(raceControl.data);
  const overtakeRows = records(overtakes.data);
  const newsRows = Array.isArray(news) ? news : [];
  const currentRaceName = text(nested(results.data, "MRData", "RaceTable", "Races", "0", "raceName"));
  const fastF1Artifacts = await getFastF1ArtifactInventory(season);
  const fastF1ArtifactRows = fastF1Artifacts.slice(0, 12).map((artifact) => [
    `${artifact.season}/${artifact.round}/${artifact.sessionCode}`,
    `session.json · ${artifact.parquetFiles} Parquet`,
    artifact.status.toUpperCase(),
  ]);

  return {
    season,
    generatedAt: new Date().toISOString(),
    openF1PublicationState,
    categories: [
      category({ id: "calendar", label: "Calendar", description: "ฤดูกาล, สนาม, locality และเวลาแข่งขันจากแหล่งหลัก", provider: "Jolpica", endpoint: `${jolpica}/${season}.json`, ok: calendar.ok, count: races.length, columns: ["ROUND", "GRAND PRIX", "CIRCUIT", "LOCATION", "RACE START"], rows: races.slice(0, 8).map(r => [text(r.round), text(r.raceName), text(nested(r, "Circuit", "circuitName")), `${text(nested(r, "Circuit", "Location", "locality"))}, ${text(nested(r, "Circuit", "Location", "country"))}`, formatDate(`${text(r.date)}T${text(r.time).replace("—", "00:00:00Z")}`)]) }),
      category({ id: "drivers", label: "Drivers", description: "รายชื่อนักขับและข้อมูลประจำตัวจาก provider", provider: "Jolpica", endpoint: `${jolpica}/${season}/drivers.json`, ok: drivers.ok, count: driverRows.length, columns: ["DRIVER ID", "CODE", "NAME", "NATIONALITY"], rows: driverRows.slice(0, 12).map(d => [text(d.driverId), text(d.code), `${text(d.givenName)} ${text(d.familyName)}`, text(d.nationality)]) }),
      category({ id: "driver-standings", label: "Driver Standings", description: "อันดับ, points, wins และทีมของนักขับ", provider: "Jolpica", endpoint: `${jolpica}/${season}/driverstandings.json`, ok: driverStandings.ok, count: driverStandingRows.length, columns: ["POS", "DRIVER", "TEAM", "POINTS", "WINS"], rows: driverStandingRows.slice(0, 12).map(s => [text(s.position), `${text(nested(s, "Driver", "givenName"))} ${text(nested(s, "Driver", "familyName"))}`, text(nested(s, "Constructors", "0", "name")), text(s.points), text(s.wins)]) }),
      category({ id: "constructor-standings", label: "Constructor Standings", description: "อันดับทีมและคะแนนสะสมของ constructors", provider: "Jolpica", endpoint: `${jolpica}/${season}/constructorstandings.json`, ok: constructorStandings.ok, count: constructorRows.length, columns: ["POS", "CONSTRUCTOR", "NATIONALITY", "POINTS", "WINS"], rows: constructorRows.slice(0, 10).map(s => [text(s.position), text(nested(s, "Constructor", "name")), text(nested(s, "Constructor", "nationality")), text(s.points), text(s.wins)]) }),
      category({ id: "race-results", label: "Race Results", description: `ผล Race ล่าสุด${currentRaceName !== "—" ? ` · ${currentRaceName}` : ""}`, provider: "Jolpica", endpoint: `${jolpica}/current/last/results.json`, ok: results.ok, count: resultRows.length, columns: ["POS", "DRIVER", "TEAM", "POINTS", "STATUS"], rows: resultRows.slice(0, 10).map(r => [text(r.position), `${text(nested(r, "Driver", "givenName"))} ${text(nested(r, "Driver", "familyName"))}`, text(nested(r, "Constructor", "name")), text(r.points), text(r.status)]) }),
      category({ id: "pit-stops", label: "Pit Stops", description: "รอบเข้าพิต, lap และเวลาหยุดจาก Race ล่าสุด", provider: "Jolpica", endpoint: `${jolpica}/current/last/pitstops.json`, ok: pitStops.ok, count: pitStopRows.length, columns: ["DRIVER", "LAP", "STOP", "TIME"], rows: pitStopRows.slice(0, 10).map(p => [text(p.driverId), text(p.lap), text(p.stop), text(p.time)]) }),
      category({ id: "sessions", label: "Sessions", description: "session key, circuit, type และช่วงเวลาใน OpenF1", provider: "OpenF1", endpoint: `${openf1}/sessions?year=${season}`, ok: sessions.ok, statusOverride: openF1Status(sessions.ok), count: sessionRecords.length, columns: ["SESSION KEY", "SESSION", "CIRCUIT", "START", "END"], rows: sessionRows.slice(0, 10).map(s => [text(s.session_key), text(s.session_name), text(s.circuit_short_name), formatDate(s.date_start), formatDate(s.date_end)]) }),
      category({ id: "laps", label: "Laps & Timing", description: "lap duration และ sector timing ของนักขับทุกคนใน session ล่าสุดที่ provider เปิดให้ใช้", provider: "OpenF1", endpoint: sessionKey === "—" ? `${openf1}/laps?session_key={session_key}` : `${openf1}/laps?session_key=${sessionKey}`, ok: laps.ok, statusOverride: openF1Status(laps.ok), count: lapRows.length, columns: ["LAP", "DRIVER", "DURATION", "SECTOR 1", "SECTOR 2"], rows: lapRows.slice(0, 10).map(l => [text(l.lap_number), text(l.driver_number), text(l.lap_duration), text(l.duration_sector_1), text(l.duration_sector_2)]) }),
      category({ id: "weather", label: "Weather", description: "อุณหภูมิ, ลม, ความชื้น และฝนจาก session ล่าสุด", provider: "OpenF1", endpoint: sessionKey === "—" ? `${openf1}/weather?session_key={session_key}` : `${openf1}/weather?session_key=${sessionKey}`, ok: weather.ok, statusOverride: openF1Status(weather.ok), count: weatherRows.length, columns: ["TIME", "AIR °C", "TRACK °C", "HUMIDITY", "RAIN"], rows: weatherRows.slice(0, 10).map(w => [formatDate(w.date), text(w.air_temperature), text(w.track_temperature), text(w.humidity), text(w.rainfall)]) }),
      category({ id: "stints", label: "Stints & Tyres", description: "stint, compound และช่วง lap ของนักขับทุกคนจาก session ล่าสุด", provider: "OpenF1", endpoint: sessionKey === "—" ? `${openf1}/stints?session_key={session_key}` : `${openf1}/stints?session_key=${sessionKey}`, ok: stints.ok, statusOverride: openF1Status(stints.ok), count: stintRows.length, columns: ["DRIVER", "STINT", "COMPOUND", "LAP START", "LAP END"], rows: stintRows.slice(0, 10).map(s => [text(s.driver_number), text(s.stint_number), text(s.compound), text(s.lap_start), text(s.lap_end)]) }),
      category({ id: "openf1-pit-stops", label: "OpenF1 Pit Stops", description: "pit duration, lane duration และ lap ของ session ล่าสุด", provider: "OpenF1", endpoint: sessionKey === "—" ? `${openf1}/pit?session_key={session_key}` : `${openf1}/pit?session_key=${sessionKey}`, ok: openf1PitStops.ok, statusOverride: openF1Status(openf1PitStops.ok), count: openf1PitStopRows.length, columns: ["DRIVER", "LAP", "PIT DURATION", "LANE DURATION"], rows: openf1PitStopRows.slice(0, 10).map(p => [text(p.driver_number), text(p.lap_number), text(p.pit_duration), text(p.lane_duration)]) }),
      category({ id: "race-control", label: "Race Control", description: "flag, message, sector และสถานะ track จาก session ล่าสุด", provider: "OpenF1", endpoint: sessionKey === "—" ? `${openf1}/race_control?session_key={session_key}` : `${openf1}/race_control?session_key=${sessionKey}`, ok: raceControl.ok, statusOverride: openF1Status(raceControl.ok), count: raceControlRows.length, columns: ["TIME", "CATEGORY", "FLAG", "LAP", "MESSAGE"], rows: raceControlRows.slice(0, 10).map(e => [formatDate(e.date), text(e.category), text(e.flag), text(e.lap_number), text(e.message)]) }),
      category({ id: "overtakes", label: "Overtakes", description: "การแซง, driver pair และตำแหน่งหลังการแซง", provider: "OpenF1", endpoint: sessionKey === "—" ? `${openf1}/overtakes?session_key={session_key}` : `${openf1}/overtakes?session_key=${sessionKey}`, ok: overtakes.ok, statusOverride: latestSessionCode && latestSessionCode !== "R" ? "not_applicable" : openF1Status(overtakes.ok), count: overtakeRows.length, columns: ["TIME", "OVERTAKER", "OVERTAKEN", "POSITION"], rows: overtakeRows.slice(0, 10).map(o => [formatDate(o.date), text(o.overtaking_driver_number), text(o.overtaken_driver_number), text(o.position)]) }),
      category({ id: "telemetry", label: "Telemetry Artifacts", description: "ไฟล์ telemetry ที่ FastF1 worker คำนวณและเก็บใน local volume หรือ object storage; ไม่เรียก FastF1 จาก browser", provider: "FastF1 worker", endpoint: process.env.TELEMETRY_STORAGE_PATH ?? "Telemetry artifact storage", ok: fastF1Artifacts.some((artifact) => artifact.status === "complete"), ...(fastF1Artifacts.length ? { statusOverride: "live" as const } : { worker: true }), count: fastF1Artifacts.length, columns: ["ARTIFACT", "FORMAT", "STATUS"], rows: fastF1ArtifactRows }),
      category({ id: "rss", label: "News RSS", description: "title, description สั้น, timestamp และลิงก์กลับ publisher ต้นทาง", provider: "RSS publishers", endpoint: process.env.RSS_FEEDS ?? "https://www.motorsport.com/rss/f1/news/,https://www.autosport.com/rss/f1/news/", ok: newsRows.length > 0, count: newsRows.length, columns: ["SOURCE", "TITLE", "PUBLISHED", "LINK"], rows: newsRows.slice(0, 10).map(item => [item.source, item.title, formatDate(item.publishedAt), item.url]) }),
    ],
  };
}

export async function getDataHub(timezone = "Asia/Bangkok", locale: Locale = "en"): Promise<DataHubSnapshot> {
  const season = Number(process.env.F1_SEASON ?? "2026");
  const cacheKey = `${season}:${timezone}:${locale}`;
  const cached = dataHubCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const active = dataHubInFlight.get(cacheKey);
  if (active) return active;
  const redisKey = redisCacheKey("data-hub", cacheKey);
  const distributed = await redisCacheGet<DataHubSnapshot>(redisKey);
  if (distributed) {
    dataHubCache.set(cacheKey, { expiresAt: Date.now() + 600_000, value: distributed });
    return distributed;
  }
  const request = loadDataHub(timezone, locale).then(value => {
    dataHubCache.set(cacheKey, { expiresAt: Date.now() + 600_000, value });
    void redisCacheSet(redisKey, value, 600);
    return value;
  }).finally(() => {
    if (dataHubInFlight.get(cacheKey) === request) dataHubInFlight.delete(cacheKey);
  });
  dataHubInFlight.set(cacheKey, request);
  return request;
}
