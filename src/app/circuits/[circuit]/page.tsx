import Link from "next/link";
import { notFound } from "next/navigation";
import { fallbackMetrics } from "@/lib/data";
import { getCircuitStats, getSeasonStandings, getSessionAnalytics } from "@/lib/data-api";
import { getScheduleRound } from "@/lib/schedule";
import { MetricGrid, StatusBadge, TrackMap, DriverGrid } from "@/components/shared";
import { CircuitStatsPanel } from "@/components/circuit-stats";
import { SessionSchedule } from "@/components/session-schedule";

export const revalidate = 600;

export default async function CircuitPage({ params }: { params: Promise<{ circuit: string }> }) {
  const pageParams = await params;
  const round = await getScheduleRound(pageParams.circuit);
  if (!round) notFound();
  const raceSession = round.sessions.at(-1);
  const [circuitStats, standingsSnapshot, analytics] = await Promise.all([
    getCircuitStats(round),
    getSeasonStandings(),
    raceSession?.status === "scheduled" ? Promise.resolve(null) : getSessionAnalytics({ sessionKey: raceSession?.sessionKey, season: round.season, round: round.round, sessionCode: raceSession?.code, sessionName: raceSession?.name, fastF1Only: true }),
  ]);

  return <><section className="circuit-hero"><div className="circuit-hero-copy"><div className="hero-kicker"><span className="eyebrow">CIRCUIT PROFILE</span><span>ROUND {String(round.round).padStart(2, "0")} · {round.season}</span></div><h1>{round.circuit.name}</h1><p className="hero-sub">{round.circuit.locality}, {round.circuit.country} · {round.circuit.lengthKm} km · {round.circuit.corners} corners</p><div className="circuit-actions"><Link href={"/rounds/" + round.round} className="primary-cta">OPEN RACE WEEKEND <span>↗</span></Link><Link href="#circuit-history" className="text-cta">Circuit history ↓</Link><Link href="/standings" className="text-cta">Driver standings</Link></div><div className="circuit-meta-grid"><span><small>RACE STATUS</small><StatusBadge status={raceSession?.status ?? "scheduled"} /></span><span><small>TRACK TYPE</small>Permanent circuit</span><span><small>HISTORY</small>{circuitStats.firstGrandPrix ? "Since " + circuitStats.firstGrandPrix : "Provider record pending"}</span></div></div><TrackMap round={round} /></section><CircuitStatsPanel circuit={round.circuit} stats={circuitStats} /><SessionSchedule round={round} /><section className="section"><div className="section-heading"><div><div className="eyebrow">FASTF1 ANALYSIS</div><h2>Track intelligence</h2></div><p><span>{analytics?.source === "FastF1" ? "FASTF1 · VALIDATED" : "FASTF1 · PENDING"}</span><br />{analytics?.sessionName ?? "No completed session yet"}</p></div><MetricGrid items={analytics?.metrics ?? fallbackMetrics} /></section><section className="section driver-focus"><div className="section-heading"><div><div className="eyebrow">DRIVER FOCUS</div><h2>Championship names</h2></div><p><span>JOLPICA SNAPSHOT</span><br />{standingsSnapshot.season} · ROUND {standingsSnapshot.round || "—"}</p></div><DriverGrid drivers={standingsSnapshot.standings.slice(0, 6)} /></section></>;
}
