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

export default async function SessionPage({ params }: { params: Promise<{ round: string; session: string }> }) {
  const pageParams = await params;
  const round = await getScheduleRound(pageParams.round);
  const session = round?.sessions.find(item => item.code.toLowerCase() === pageParams.session.toLowerCase());
  if (!round || !session) notFound();
  const [analytics, locale, timezone, timezoneMode] = await Promise.all([session.status === "scheduled" ? Promise.resolve(null) : getSessionAnalytics({ sessionKey: session.sessionKey, season: round.season, round: round.round, sessionCode: session.code, sessionName: session.name, fastF1Only: true }), getLocale(), getTimezone(), getTimezoneMode()]);
  const effectiveTimezone = displayTimezone(timezoneMode, timezone, round.circuit.country, round.circuit.locality);

  return <><PageHead eyebrow={`${round.name} · ${session.code}`} title={session.name}>Jolpica results, OpenF1 context and FastF1-only validated analysis <StatusBadge status={session.status} /></PageHead><SessionCountdown session={session} locale={locale} timezone={effectiveTimezone}/>{session.status === "scheduled" ? <div className="empty">This session has not started yet. FastF1 analysis will appear after the worker publishes a validated artifact.</div> : analytics ? <><SessionResults analytics={analytics} locale={locale}/><MetricGrid items={analytics.metrics} /><section className="section panel"><h2>FastF1 lap-by-lap pace</h2><PaceChart data={analytics.pace} /></section></> : <MetricGrid items={fallbackMetrics} />}</>;
}
