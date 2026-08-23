import Link from "next/link";
import { PageHead, TrackMap } from "@/components/shared";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";
import { getScheduleRounds } from "@/lib/schedule";
import { getCircuitHistorySummariesBySlug } from "@/lib/data-api";
import { CircuitHistoryCard } from "@/components/circuit-history-card";

export const revalidate = 600;

export default async function Circuits() {
  const [locale, rounds] = await Promise.all([getLocale(), getScheduleRounds()]);
  const histories = await getCircuitHistorySummariesBySlug(rounds.map(round => round.slug));

  return <><PageHead eyebrow="TRACK DATABASE" title="Circuits">{message(locale, "circuitsDescription")}</PageHead><div className="round-grid">{rounds.map(round => <Link className="round-card" href={"/circuits/" + round.slug} key={round.slug}><TrackMap round={round} /><h3>{round.circuit.name}</h3><p>{round.circuit.country} · {round.circuit.lengthKm} km · {round.circuit.corners} corners</p><CircuitHistoryCard history={histories[round.slug] ?? { source: "fallback" }} lengthKm={round.circuit.lengthKm} corners={round.circuit.corners} builtYear={round.circuit.builtYear} /></Link>)}</div></>;
}