import { getDataHub, type DataCategory } from "./data-api";

export type DiagnosticStatus = "live" | "partial" | "processing" | "unavailable" | "not_configured" | "not_applicable";
export type DiagnosticConfiguration = "configured" | "default" | "not_configured";

export interface DiagnosticCheck {
  id: string;
  label: string;
  provider: string;
  status: DiagnosticStatus;
  records: number;
  expected?: number;
  coverage?: number;
  scope?: string;
  endpoint: string;
  reason: string;
}

export interface DiagnosticProvider {
  id: string;
  label: string;
  configuration: DiagnosticConfiguration;
  endpoint: string;
  checks: number;
  liveChecks: number;
  partialChecks: number;
  blockedChecks: number;
  notApplicableChecks: number;
}

export interface CompletenessSnapshot {
  generatedAt: string;
  season: number;
  environment: "development" | "production" | "test";
  latestSession?: {
    sessionKey: string;
    sessionName: string;
    circuit: string;
    startsAt: string;
  };
  summary: {
    totalChecks: number;
    live: number;
    partial: number;
    blocked: number;
    notApplicable: number;
    totalRecords: number;
  };
  providers: DiagnosticProvider[];
  checks: DiagnosticCheck[];
}

const DEFAULT_RSS_FEEDS = "https://www.motorsport.com/rss/f1/news/,https://www.autosport.com/rss/f1/news/";
let snapshotCache: { expiresAt: number; value: CompletenessSnapshot } | undefined;
let snapshotInFlight: Promise<CompletenessSnapshot> | undefined;

export function diagnosticsEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_DIAGNOSTICS === "true";
}

function safeEndpoint(value: string) {
  return value.split(",").map((part) => {
    const endpoint = part.trim();
    if (!endpoint) return "";
    try {
      const url = new URL(endpoint);
      return `${url.origin}${url.pathname}`;
    } catch {
      return endpoint;
    }
  }).filter(Boolean).join(" · ");
}

function categoryStatus(category: DataCategory, expected?: number): DiagnosticStatus {
  if (category.status === "not_applicable") return "not_applicable";
  if (category.status === "worker") return "processing";
  if (category.status === "awaiting_data") return "processing";
  if (!category.status || category.count === 0) return "unavailable";
  if (expected !== undefined && category.count < expected) return "partial";
  return "live";
}

function categoryReason(category: DataCategory, status: DiagnosticStatus, expected?: number) {
  if (status === "not_applicable") return "OpenF1 overtakes are only available for Race sessions; this snapshot is not a Race.";
  if (category.status === "worker") return "Worker artifact is not published to the application data layer yet.";
  if (category.status === "awaiting_data") return "OpenF1 publishes session data after the session; the worker will retry and keep the latest published snapshot.";
  if (status === "unavailable") return category.status === "unavailable" ? "Provider request failed or returned no usable records." : "Provider returned an empty dataset.";
  if (status === "partial" && expected !== undefined) return `${category.count} of ${expected} expected records are available.`;
  if (category.id === "laps" || category.id === "stints") return "Latest session sample includes all drivers returned by OpenF1; the preview table shows the first 10 rows.";
  if (category.id === "race-results" || category.id === "pit-stops") return "Latest completed Race endpoint only; historical rows are available through the provider endpoint.";
  return "Provider returned usable records for this snapshot.";
}

function expectedRecords(categoryId: string) {
  // Provider truth can differ from the active race grid (for example, a season
  // standings feed may include a replacement driver). Do not invent a fixed 22.
  void categoryId;
  return undefined;
}

export function buildDiagnosticCheck(category: DataCategory): DiagnosticCheck {
  const expected = expectedRecords(category.id);
  const status = categoryStatus(category, expected);
  return {
    id: category.id,
    label: category.label,
    provider: category.provider,
    status,
    records: category.count,
    ...(expected === undefined ? {} : { expected, coverage: Math.min(100, Math.round(category.count / expected * 100)) }),
    ...(category.id === "laps" || category.id === "stints" ? { scope: "latest session · all drivers" } : {}),
    endpoint: safeEndpoint(category.endpoint),
    reason: categoryReason(category, status, expected),
  };
}

function configuration(value: string | undefined, fallback?: string): DiagnosticConfiguration {
  if (value) return "configured";
  return fallback ? "default" : "not_configured";
}

function configurationReason(status: DiagnosticStatus, label: string) {
  if (status === "live") return `${label} is configured and ready.`;
  if (status === "processing") return `${label} is available through the worker pipeline but has no published artifact.`;
  return `${label} is not configured in this runtime.`;
}

function runtimeCheck(id: string, label: string, provider: string, configured: boolean, endpoint: string, processing = false): DiagnosticCheck {
  const status: DiagnosticStatus = processing ? "processing" : configured ? "live" : "not_configured";
  return {
    id,
    label,
    provider,
    status,
    records: 0,
    endpoint: safeEndpoint(endpoint),
    reason: configurationReason(status, label),
  };
}

function providerConfig(id: string): { configuration: DiagnosticConfiguration; endpoint: string } {
  if (id === "jolpica") {
    const value = process.env.JOLPICA_BASE_URL;
    return { configuration: configuration(value, "https://api.jolpi.ca/ergast/f1"), endpoint: safeEndpoint(value ?? "https://api.jolpi.ca/ergast/f1") };
  }
  if (id === "openf1") {
    const value = process.env.OPENF1_BASE_URL;
    return { configuration: configuration(value, "https://api.openf1.org/v1"), endpoint: safeEndpoint(value ?? "https://api.openf1.org/v1") };
  }
  if (id === "rss") {
    const value = process.env.RSS_FEEDS;
    return { configuration: configuration(value, DEFAULT_RSS_FEEDS), endpoint: safeEndpoint(value ?? DEFAULT_RSS_FEEDS) };
  }
  if (id === "fastf1") {
    const value = process.env.FASTF1_CACHE;
    return { configuration: configuration(value), endpoint: process.env.TELEMETRY_STORAGE_PATH ?? "Telemetry artifact storage" };
  }
  if (id === "database") {
    return { configuration: configuration(process.env.DATABASE_URL), endpoint: "PostgreSQL" };
  }
  const value = process.env.TELEMETRY_STORAGE_PATH;
  return { configuration: configuration(value), endpoint: value ?? "Telemetry artifact storage" };
}

async function collectCompletenessSnapshot(): Promise<CompletenessSnapshot> {
  const season = Number(process.env.F1_SEASON ?? "2026");
  const dataHub = await getDataHub("UTC", "en");
  const checks = dataHub.categories.map(buildDiagnosticCheck);
  const telemetryArtifacts = dataHub.categories.find((category) => category.id === "telemetry")?.count ?? 0;
  const runtimeChecks = [
    runtimeCheck("database", "Application database", "PostgreSQL", Boolean(process.env.DATABASE_URL), "PostgreSQL"),
    runtimeCheck("storage", "Telemetry storage", "Local volume / object storage", Boolean(process.env.TELEMETRY_STORAGE_PATH), process.env.TELEMETRY_STORAGE_PATH ?? "Telemetry artifact storage"),
    runtimeCheck("fastf1-worker", "FastF1 worker", "FastF1 worker", Boolean(process.env.FASTF1_CACHE), process.env.TELEMETRY_STORAGE_PATH ?? "Telemetry artifact storage", telemetryArtifacts === 0),
  ];
  const allChecks = [...checks, ...runtimeChecks];
  const statusCounts = (status: DiagnosticStatus) => allChecks.filter((check) => check.status === status).length;
  const sessionRow = dataHub.categories.find((category) => category.id === "sessions")?.rows[0];
  const session = sessionRow ? { sessionKey: sessionRow[0] ?? "—", sessionName: sessionRow[1] ?? "—", circuit: sessionRow[2] ?? "—", startsAt: sessionRow[3] ?? "—" } : undefined;
  const providers = [
    { id: "jolpica", label: "Jolpica", categoryIds: ["calendar", "drivers", "driver-standings", "constructor-standings", "race-results", "pit-stops"] },
    { id: "openf1", label: "OpenF1", categoryIds: ["sessions", "laps", "weather", "stints", "openf1-pit-stops", "race-control", "overtakes"] },
    { id: "rss", label: "RSS publishers", categoryIds: ["rss"] },
    { id: "fastf1", label: "FastF1 worker", categoryIds: ["telemetry", "fastf1-worker"] },
    { id: "database", label: "PostgreSQL", categoryIds: ["database"] },
    { id: "storage", label: "Telemetry storage", categoryIds: ["storage"] },
  ].map((provider) => {
    const providerChecks = allChecks.filter((check) => provider.categoryIds.includes(check.id));
    const config = providerConfig(provider.id);
    return {
      id: provider.id,
      label: provider.label,
      configuration: config.configuration,
      endpoint: config.endpoint,
      checks: providerChecks.length,
      liveChecks: providerChecks.filter((check) => check.status === "live").length,
      partialChecks: providerChecks.filter((check) => check.status === "partial").length,
      blockedChecks: providerChecks.filter((check) => ["unavailable", "processing", "not_configured"].includes(check.status)).length,
      notApplicableChecks: providerChecks.filter((check) => check.status === "not_applicable").length,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    season: Number.isFinite(season) ? season : dataHub.season,
    environment: process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "test" ? "test" : "development",
    ...(session ? { latestSession: session } : {}),
    summary: {
      totalChecks: allChecks.length,
      live: statusCounts("live"),
      partial: statusCounts("partial"),
      blocked: allChecks.filter((check) => ["unavailable", "processing", "not_configured"].includes(check.status)).length,
      notApplicable: statusCounts("not_applicable"),
      totalRecords: checks.reduce((total, check) => total + check.records, 0),
    },
    providers,
    checks: allChecks,
  };
}

export async function getCompletenessSnapshot(): Promise<CompletenessSnapshot> {
  if (snapshotCache && snapshotCache.expiresAt > Date.now()) return snapshotCache.value;
  if (snapshotInFlight) return snapshotInFlight;
  snapshotInFlight = collectCompletenessSnapshot();
  try {
    const value = await snapshotInFlight;
    snapshotCache = { expiresAt: Date.now() + 60_000, value };
    return value;
  } finally {
    snapshotInFlight = undefined;
  }
}

export function diagnosticStatusLabel(status: DiagnosticStatus) {
  return status.replaceAll("_", " ").toUpperCase();
}
