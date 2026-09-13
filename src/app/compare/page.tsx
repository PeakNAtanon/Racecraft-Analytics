import { Suspense } from "react";
import { getSeasonComparison, getSessionAnalytics } from "@/lib/data-api";
import { PageHead } from "@/components/shared";
import { CompareLab } from "@/components/compare-lab";
import { getLocale } from "@/lib/i18n-server";
import { message, type Locale } from "@/lib/i18n";
import { filterComparisonSessions, latestFastF1Session, resolveComparisonFilters } from "@/lib/compare";
import { getFastF1ArtifactInventory } from "@/lib/fastf1-artifacts";
import { RouteLoading } from "@/components/route-loading";
import { getWebSeasons, resolveWebSeason } from "@/lib/web-seasons";

type CompareQuery = { drivers?: string | string[]; session?: string; round?: string; circuit?: string; season?: string; compareSeason?: string };

async function CompareContent({ requestedDrivers, locale, query }: { requestedDrivers: string[]; locale: Locale; query: CompareQuery }) {
  const availableSeasons = getWebSeasons();
  const season = resolveWebSeason(query.season);
  const requestedSeason = Number(query.season);
  const hiddenSeasonRequested = Number.isInteger(requestedSeason) && requestedSeason !== season;
  const requestedReference = Number(query.compareSeason);
  const referenceSeason = availableSeasons.includes(requestedReference) && requestedReference !== season ? requestedReference : undefined;
  const [comparison, referenceComparison] = await Promise.all([getSeasonComparison(season), referenceSeason ? getSeasonComparison(referenceSeason) : Promise.resolve(undefined)]);
  const artifacts = await getFastF1ArtifactInventory(comparison.season);
  const filters = resolveComparisonFilters(comparison.sessions, artifacts, hiddenSeasonRequested ? {} : query);
  const matchingSessions = filterComparisonSessions(comparison.sessions, filters);
  const latestSession = latestFastF1Session(matchingSessions, artifacts);
  const availableSession = latestFastF1Session(comparison.sessions, artifacts);
  const availableSessionHref = availableSession ? `/rounds/${availableSession.round}/${availableSession.sessionCode.toLowerCase()}?season=${season}` : undefined;
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
  return <CompareLab key={`${season}:${referenceSeason}:${JSON.stringify(filters)}`} availableSeasons={availableSeasons} filters={filters} drivers={comparison.drivers} pace={analytics ? { ...analytics.pace, availableSessionHref } : { sessionLabel: "FastF1 pending · selected filters", source: "fallback", laps: [], series: [], dataState: matchingSessions.length ? "processing" : "unavailable", availableSessionHref }} stints={analytics?.stints ?? []} telemetryByDriver={analytics?.telemetryByDriver} comparison={comparison} referenceComparison={referenceComparison} locale={locale} initialDriverCodes={requestedDrivers} />;
}

export default async function Compare({ searchParams }: { searchParams?: Promise<CompareQuery> }) {
  const query = await searchParams ?? {};
  const requestedDrivers = (Array.isArray(query?.drivers) ? query?.drivers.join(",") : query?.drivers ?? "").split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
  const locale = await getLocale();
  return <><PageHead eyebrow="COMPARISON LAB · FASTF1" title="Compare">{message(locale, "compareDescription")}</PageHead><Suspense fallback={<RouteLoading label="Loading driver comparison…" />}><CompareContent requestedDrivers={requestedDrivers} locale={locale} query={query} /></Suspense></>;
}
