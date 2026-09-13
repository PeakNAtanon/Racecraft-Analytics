import { Suspense } from "react";
import { getSeasonComparison, getSessionAnalytics } from "@/lib/data-api";
import { PageHead } from "@/components/shared";
import { CompareLab } from "@/components/compare-lab";
import { getLocale } from "@/lib/i18n-server";
import { message, type Locale } from "@/lib/i18n";
import { filterComparisonSessions, latestFastF1Session, type ComparisonFilters } from "@/lib/compare";
import { getFastF1ArtifactInventory } from "@/lib/fastf1-artifacts";
import { RouteLoading } from "@/components/route-loading";

type CompareQuery = { drivers?: string | string[]; session?: string; round?: string; circuit?: string };

async function CompareContent({ requestedDrivers, locale, query }: { requestedDrivers: string[]; locale: Locale; query: CompareQuery }) {
  const comparison = await getSeasonComparison();
  const filters: ComparisonFilters = {
    session: query.session ?? (comparison.sessions.some(session => session.sessionCode === "R" && session.results.length) ? "R" : "ALL"),
    round: query.round ?? "ALL",
    circuit: query.circuit ?? "ALL",
  };
  const artifacts = await getFastF1ArtifactInventory(comparison.season);
  const matchingSessions = filterComparisonSessions(comparison.sessions, filters);
  const latestSession = latestFastF1Session(matchingSessions, artifacts);
  const availableSession = latestFastF1Session(comparison.sessions, artifacts);
  const availableSessionHref = availableSession ? `/rounds/${availableSession.round}/${availableSession.sessionCode.toLowerCase()}` : undefined;
  const analytics = latestSession ? await getSessionAnalytics({
    season: comparison.season,
    sessionKey: latestSession?.sessionKey,
    round: latestSession?.round,
    sessionCode: latestSession?.sessionCode,
    sessionName: latestSession?.sessionName,
    includeStints: true,
    driverCodes: requestedDrivers,
    fastF1Only: true,
  }) : null;
  return <CompareLab key={JSON.stringify(filters)} filters={filters} drivers={comparison.drivers} pace={analytics ? { ...analytics.pace, availableSessionHref } : { sessionLabel: "FastF1 pending · selected filters", source: "fallback", laps: [], series: [], dataState: matchingSessions.length ? "processing" : "unavailable", availableSessionHref }} stints={analytics?.stints ?? []} telemetryByDriver={analytics?.telemetryByDriver} comparison={comparison} locale={locale} initialDriverCodes={requestedDrivers} />;
}

export default async function Compare({ searchParams }: { searchParams?: Promise<CompareQuery> }) {
  const query = await searchParams ?? {};
  const requestedDrivers = (Array.isArray(query?.drivers) ? query?.drivers.join(",") : query?.drivers ?? "").split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
  const locale = await getLocale();
  return <><PageHead eyebrow="COMPARISON LAB · FASTF1" title="Compare">{message(locale, "compareDescription")}</PageHead><Suspense fallback={<RouteLoading label="Loading driver comparison…" />}><CompareContent requestedDrivers={requestedDrivers} locale={locale} query={query} /></Suspense></>;
}
