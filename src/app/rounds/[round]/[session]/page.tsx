import { AnalysisDataState } from "@/components/analysis-data-state";
import { notFound } from "next/navigation";
import { getSessionAnalytics } from "@/lib/data-api";
import { getScheduleRound } from "@/lib/schedule";
import { fallbackMetrics } from "@/lib/data";
import { MetricGrid, PageHead, StatusBadge } from "@/components/shared";
import { SessionCountdown } from "@/components/session-countdown";
import { PaceChart } from "@/components/pace-chart";
import { SessionResults } from "@/components/session-results";
import { getLocale } from "@/lib/i18n-server";
import { getTimezone, getTimezoneMode } from "@/lib/timezone-server";
import { displayTimezone } from "@/lib/timezone";
import { isWebSeasonVisible, resolveWebSeason } from "@/lib/web-seasons";

export default async function SessionPage({ params, searchParams }: { params: Promise<{ round: string; session: string }>; searchParams?: Promise<{ season?: string }> }) {
  const pageParams = await params;
  const query = await searchParams;
  const requestedSeason = Number(query?.season);
  if (query?.season && Number.isInteger(requestedSeason) && !isWebSeasonVisible(requestedSeason)) notFound();
  const season = resolveWebSeason(query?.season);
  const round = await getScheduleRound(pageParams.round, season);
  const session = round?.sessions.find(item => item.code.toLowerCase() === pageParams.session.toLowerCase());
  if (!round || !session) notFound();
  const [analytics, locale, timezone, timezoneMode] = await Promise.all([session.status === "scheduled" ? Promise.resolve(null) : getSessionAnalytics({ sessionKey: session.sessionKey, season: round.season, round: round.round, sessionCode: session.code, sessionName: session.name, fastF1Only: true }), getLocale(), getTimezone(), getTimezoneMode()]);
  const effectiveTimezone = displayTimezone(timezoneMode, timezone, round.circuit.country, round.circuit.locality);

  return <><PageHead eyebrow={`${round.name} · ${session.code}`} title={session.name}>Jolpica results, OpenF1 context and FastF1-only validated analysis <StatusBadge status={session.status} /></PageHead><SessionCountdown session={session} locale={locale} timezone={effectiveTimezone}/>{session.status === "scheduled" ? <AnalysisDataState state="scheduled" locale={locale} /> : analytics ? <><SessionResults analytics={analytics} locale={locale}/><MetricGrid items={analytics.metrics} /><section className="section panel"><h2>FastF1 lap-by-lap pace</h2><PaceChart data={analytics.pace} locale={locale} /></section></> : <MetricGrid items={fallbackMetrics} />}</>;
}
