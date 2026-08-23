import { getSeasonComparison, getSessionAnalytics } from "@/lib/data-api";
import { PageHead } from "@/components/shared";
import { CompareLab } from "@/components/compare-lab";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";
import { latestFastF1Session } from "@/lib/compare";
import { getFastF1ArtifactInventory } from "@/lib/fastf1-artifacts";

export default async function Compare({ searchParams }: { searchParams?: Promise<{ drivers?: string | string[] }> }) {
  const query = await searchParams;
  const requestedDrivers = (Array.isArray(query?.drivers) ? query?.drivers.join(",") : query?.drivers ?? "").split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
  const [comparison, locale] = await Promise.all([getSeasonComparison(), getLocale()]);
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
  return <><PageHead eyebrow="COMPARISON LAB · FASTF1" title="Compare">{message(locale, "compareDescription")}</PageHead><CompareLab drivers={comparison.drivers} pace={analytics.pace} stints={analytics.stints} telemetryByDriver={analytics.telemetryByDriver} comparison={comparison} locale={locale} initialDriverCodes={requestedDrivers} /></>;
}
