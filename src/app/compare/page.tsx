import { Suspense } from "react";
import { getSeasonComparison, getSessionAnalytics } from "@/lib/data-api";
import { PageHead } from "@/components/shared";
import { CompareLab } from "@/components/compare-lab";
import { getLocale } from "@/lib/i18n-server";
import { message, type Locale } from "@/lib/i18n";
import { latestFastF1Session } from "@/lib/compare";
import { getFastF1ArtifactInventory } from "@/lib/fastf1-artifacts";
import { RouteLoading } from "@/components/route-loading";

async function CompareContent({ requestedDrivers, locale }: { requestedDrivers: string[]; locale: Locale }) {
  const comparison = await getSeasonComparison();
  const artifacts = await getFastF1ArtifactInventory(comparison.season);
  const latestSession = latestFastF1Session(comparison.sessions, artifacts);
  const analytics = await getSessionAnalytics({
    season: comparison.season,
    sessionKey: latestSession?.sessionKey,
    round: latestSession?.round,
    sessionCode: latestSession?.sessionCode,
    sessionName: latestSession?.sessionName,
    includeStints: true,
    driverCodes: requestedDrivers,
    fastF1Only: true,
  });
  return <CompareLab drivers={comparison.drivers} pace={analytics.pace} stints={analytics.stints} telemetryByDriver={analytics.telemetryByDriver} comparison={comparison} locale={locale} initialDriverCodes={requestedDrivers} />;
}

export default async function Compare({ searchParams }: { searchParams?: Promise<{ drivers?: string | string[] }> }) {
  const query = await searchParams;
  const requestedDrivers = (Array.isArray(query?.drivers) ? query?.drivers.join(",") : query?.drivers ?? "").split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
  const locale = await getLocale();
  return <><PageHead eyebrow="COMPARISON LAB · FASTF1" title="Compare">{message(locale, "compareDescription")}</PageHead><Suspense fallback={<RouteLoading variant="dashboard" label="Loading driver comparison…" />}><CompareContent requestedDrivers={requestedDrivers} locale={locale} /></Suspense></>;
}
