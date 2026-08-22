import Link from "next/link";
import { getNews } from "@/lib/data";
import { getCircuitStats, getSeasonStandings, getSessionAnalytics } from "@/lib/data-api";
import { currentScheduleRound, getScheduleRounds } from "@/lib/schedule";
import { AdSlot, MetricGrid, RoundCard, StatusBadge, TrackMap } from "@/components/shared";
import { SessionCountdown } from "@/components/session-countdown";
import { PaceChart } from "@/components/pace-chart";
import { SessionResults } from "@/components/session-results";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";
import { getTimezone } from "@/lib/timezone-server";
import { getTeamColor } from "@/lib/team-colors";
import { displayTimezone } from "@/lib/timezone";
import { getTimezoneMode } from "@/lib/timezone-server";
import { TrackData } from "@/components/track-data";
import { WeatherPanel } from "@/components/weather-panel";
import { CircuitStatsPanel } from "@/components/circuit-stats";

export const revalidate = 600;

export default async function Home() {
  const schedule = await getScheduleRounds();
  const [locale, timezone, timezoneMode] = await Promise.all([getLocale(), getTimezone(), getTimezoneMode()]);
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const round = currentScheduleRound(schedule);
  const [news, standingsSnapshot, analytics, circuitStats] = await Promise.all([getNews(), getSeasonStandings(), getSessionAnalytics({ fastF1Only: true }), getCircuitStats(round)]);
  const standings = standingsSnapshot.standings;
  const nextSession = round.sessions.find(session => session.status === "scheduled") ?? round.sessions.at(-1);
  const effectiveTimezone = displayTimezone(timezoneMode, timezone, round.circuit.country, round.circuit.locality);
  const timeContext = timezoneMode === "track" ? message(locale, "trackTime") : message(locale, "myTime");

  return <>
    <section className="hero"><div className="hero-copy"><div className="hero-kicker"><span className="eyebrow">CURRENT ROUND · API SCHEDULE</span><span>2026 / R{String(round.round).padStart(2, "0")}</span></div><div className="hero-number" aria-hidden="true">{String(round.round).padStart(2, "0")}</div><h1>{round.name}</h1><p className="hero-sub">{message(locale, "homeLead")}</p><div className="hero-actions"><Link href={`/rounds/${round.round}`} className="primary-cta">EXPLORE ROUND <span>↗</span></Link><Link href="/methodology" className="text-cta">How we calculate</Link></div><div className="hero-meta"><span><small>LOCATION</small>{round.circuit.locality}, {round.circuit.country}</span><span><small>RACE DATE</small>{new Intl.DateTimeFormat(dateLocale, { dateStyle: "long", timeZone: effectiveTimezone }).format(new Date(round.raceStartsAt))}</span><span><small>DATA STATUS</small><StatusBadge status={round.sessions.at(-1)?.status ?? "scheduled"} /></span></div></div><TrackMap round={round} /><div className="session-rail">{round.sessions.map((session, index) => <Link href={`/rounds/${round.round}/${session.code.toLowerCase()}`} key={session.code} className={session.status === "scheduled" && index === 0 ? "current" : ""}><span>{session.code}</span><small>{session.status.replaceAll("_", " ")}</small></Link>)}</div></section>
    {nextSession ? <section className="home-countdown"><div><div className="eyebrow">NEXT SESSION · COUNTDOWN</div><h2>{nextSession.name}</h2><p>{round.name} · {timeContext}</p></div><SessionCountdown session={nextSession} locale={locale} timezone={effectiveTimezone} /></section> : null}
    <TrackData round={round} timezone={effectiveTimezone} timezoneMode={timezoneMode} />
    <CircuitStatsPanel circuit={round.circuit} stats={circuitStats} />
    <WeatherPanel weather={analytics.weather} trackName={round.circuit.name} timezone={effectiveTimezone} locale={locale} />
    <SessionResults analytics={analytics} locale={locale} />
    <AdSlot />
    <section className="section analytics-section"><div className="section-heading"><div><div className="eyebrow">FASTF1 ANALYSIS</div><h2>{message(locale, "homeAnalyticsTitle")}</h2></div><p>{analytics.source === "FastF1" ? "FASTF1 VALIDATED ANALYSIS" : "FASTF1 ANALYSIS · PENDING"}<br /><span>{analytics.pace.sessionLabel}</span></p></div><MetricGrid items={analytics.metrics} /></section>
    <section className="section grid-2"><article className="panel"><div className="eyebrow">RACE PACE</div><h2>Clean-lap pace trend</h2><PaceChart data={analytics.pace} /></article><article className="panel"><div className="eyebrow">CHAMPIONSHIP · JOLPICA</div><h2>Driver standings</h2><table className="data-table"><tbody>{standings.slice(0, 6).map(standing => <tr key={standing.code} style={{ "--team-color": getTeamColor(standing.team, standing.color) } as React.CSSProperties}><td className="rank">{standing.position}</td><td><span className="driver-code"><span className="team-color-swatch" aria-hidden="true" />{standing.code}</span><br /><small>{standing.team}</small></td><td className="mono">{standing.points === undefined ? "—" : `${standing.points} PTS`}<div className="progress"><span style={{ width: `${standing.points === undefined ? 0 : standing.points / Math.max(standings[0]?.points ?? 1, 1) * 100}%` }} /></div></td></tr>)}</tbody></table><Link href="/standings" className="link-arrow">{message(locale, "homeStandingsLink")}</Link></article></section>
    <section className="section"><div className="section-heading"><div><div className="eyebrow">NEWS WIRE · RSS</div><h2>{message(locale, "homeNewsTitle")}</h2></div><Link href="/analysis" className="link-arrow">{message(locale, "homeNewsAll")}</Link></div>{news.length ? <div className="news-grid">{news.slice(0, 3).map(item => <a className="news-card" href={item.url} target="_blank" rel="noopener noreferrer" key={item.id}><div className={`news-card-media${item.imageUrl ? " has-image" : ""}`} style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined} role="img" aria-label={`${item.title} preview`}><div className="news-card-fallback" aria-hidden="true"><span>RACECRAFT</span><strong>NEWS WIRE</strong><i /></div></div><div className="news-card-body"><span className="news-source">{item.source} · {new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeZone: effectiveTimezone }).format(new Date(item.publishedAt))}</span><h3>{item.title}</h3><p>{item.description}</p></div></a>)}</div> : <div className="empty">{message(locale, "homeNewsEmpty")}</div>}</section>
    <section className="section"><div className="section-heading"><div><div className="eyebrow">UP NEXT</div><h2>{message(locale, "homeNextTitle")}</h2></div><Link href="/calendar" className="link-arrow">{message(locale, "homeCalendarLink")}</Link></div><div className="round-grid">{schedule.slice(Math.max(0, round.round - 1), round.round + 2).map(item => <RoundCard key={item.round} item={item} timezone={timezone} timezoneMode={timezoneMode} locale={locale} />)}</div></section>
  </>;
}
