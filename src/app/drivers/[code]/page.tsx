import { notFound } from "next/navigation";
import { DriverAnalysisView } from "@/components/driver-analysis";
import { getDriverAnalysis } from "@/lib/data-api";
import { getLocale } from "@/lib/i18n-server";
import { getTimezone } from "@/lib/timezone-server";

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
  const season = Number.isInteger(Number(seasonValue)) && Number(seasonValue) > 0 ? Number(seasonValue) : Number(process.env.F1_SEASON ?? "2026");
  const snapshot = await getDriverAnalysis({
    season,
    code,
    ...(sessionKeyValue && sessionKeyValue !== "ALL" && Number.isFinite(Number(sessionKeyValue)) ? { sessionKey: Number(sessionKeyValue) } : {}),
    ...(roundValue && roundValue !== "ALL" && Number.isFinite(Number(roundValue)) ? { round: Number(roundValue) } : {}),
    ...(circuitValue && circuitValue !== "ALL" ? { circuit: circuitValue } : {}),
    ...(sessionCodeValue && sessionCodeValue !== "ALL" ? { sessionCode: sessionCodeValue as "FP1" | "FP2" | "FP3" | "SQ" | "SPR" | "Q" | "R" } : {}),
  });
  if (!snapshot) notFound();
  return <DriverAnalysisView snapshot={snapshot} locale={locale} timezone={timezone} filters={{ season: String(season), round: roundValue ?? "ALL", circuit: circuitValue ?? "ALL", sessionCode: sessionCodeValue ?? "ALL", sessionKey: sessionKeyValue ?? "ALL" }} />;
}
