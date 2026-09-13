import { notFound } from "next/navigation";
import { DriverAnalysisView } from "@/components/driver-analysis";
import { getDriverAnalysis } from "@/lib/data-api";
import { getLocale } from "@/lib/i18n-server";
import { getTimezone } from "@/lib/timezone-server";
import { getWebSeasons, resolveWebSeason } from "@/lib/web-seasons";

export const revalidate = 600;

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DriverDetail({ params, searchParams }: { params: Promise<{ code: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ code }, locale, timezone] = await Promise.all([params, getLocale(), getTimezone()]);
  const query: Record<string, string | string[] | undefined> = searchParams ? await searchParams : {};
  const seasonValue = queryValue(query.season);
  const sessionKeyValue = queryValue(query.sessionKey);
  const roundValue = queryValue(query.round);
  const circuitValue = queryValue(query.circuit);
  const sessionCodeValue = queryValue(query.sessionCode);
  const availableSeasons = getWebSeasons();
  const season = resolveWebSeason(seasonValue);
  const hiddenSeasonRequested = Number.isInteger(Number(seasonValue)) && Number(seasonValue) !== season;
  const effectiveSessionKeyValue = hiddenSeasonRequested ? undefined : sessionKeyValue;
  const effectiveRoundValue = hiddenSeasonRequested ? undefined : roundValue;
  const effectiveCircuitValue = hiddenSeasonRequested ? undefined : circuitValue;
  const effectiveSessionCodeValue = hiddenSeasonRequested ? undefined : sessionCodeValue;
  const snapshot = await getDriverAnalysis({
    season,
    code,
    ...(effectiveSessionKeyValue && effectiveSessionKeyValue !== "ALL" && Number.isFinite(Number(effectiveSessionKeyValue)) ? { sessionKey: Number(effectiveSessionKeyValue) } : {}),
    ...(effectiveRoundValue && effectiveRoundValue !== "ALL" && Number.isFinite(Number(effectiveRoundValue)) ? { round: Number(effectiveRoundValue) } : {}),
    ...(effectiveCircuitValue && effectiveCircuitValue !== "ALL" ? { circuit: effectiveCircuitValue } : {}),
    ...(effectiveSessionCodeValue && effectiveSessionCodeValue !== "ALL" ? { sessionCode: effectiveSessionCodeValue as "FP1" | "FP2" | "FP3" | "SQ" | "SPR" | "Q" | "R" } : {}),
  });
  if (!snapshot) notFound();
  return <DriverAnalysisView availableSeasons={availableSeasons} snapshot={snapshot} locale={locale} timezone={timezone} filters={{ season: String(season), round: effectiveRoundValue ?? "ALL", circuit: effectiveCircuitValue ?? "ALL", sessionCode: effectiveSessionCodeValue ?? "ALL", sessionKey: effectiveSessionKeyValue ?? "ALL" }} />;
}
