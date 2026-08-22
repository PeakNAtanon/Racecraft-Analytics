import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionAnalytics } from "@/lib/data-api";
import { getScheduleRound } from "@/lib/schedule";
import { AdSlot, MetricGrid, StatusBadge, TrackMap } from "@/components/shared";
import { SessionSchedule } from "@/components/session-schedule";
import { PaceChart } from "@/components/pace-chart";

export default async function RoundPage({ params }: { params: Promise<{ round: string }> }) {
  const { round: value } = await params;
  const round = await getScheduleRound(value);
  if (!round) notFound();
  const raceSession = round.sessions.find(session => session.code === "R") ?? round.sessions.at(-1);
  const analytics = await getSessionAnalytics({ sessionKey: raceSession?.sessionKey, season: round.season, round: round.round, sessionCode: raceSession?.code, sessionName: raceSession?.name, fastF1Only: true });

  return <><section className="hero"><div className="hero-copy"><div className="eyebrow">ROUND {String(round.round).padStart(2, "0")} · {round.season}</div><h1>{round.name}</h1><p className="hero-sub">{round.circuit.name} · {round.circuit.lengthKm} km · {round.circuit.corners} corners</p><div className="session-strip">{round.sessions.map(session => <Link key={session.code} href={`/rounds/${round.round}/${session.code.toLowerCase()}`} className="session-chip"><b>{session.code}</b><StatusBadge status={session.status} /></Link>)}</div></div><TrackMap round={round} /></section><SessionSchedule round={round} /><AdSlot /><section className="section"><div className="section-heading"><div><div className="eyebrow">FASTF1 ANALYSIS</div><h2>Weekend snapshot</h2></div><p><span>{analytics.source === "FastF1" ? "FASTF1 · VALIDATED" : "FASTF1 · PENDING"}</span><br />{analytics.sessionName}</p></div><MetricGrid items={analytics.metrics} /></section><section className="section panel"><h2>FastF1 race pace comparison</h2><PaceChart data={analytics.pace} /></section></>;
}
