import { getScheduleRounds } from "@/lib/schedule";

const q = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;

export async function GET() {
  const rounds = await getScheduleRounds();
  const rows = [["season", "round", "grand_prix", "circuit", "country", "race_start_utc"], ...rounds.map(round => [round.season, round.round, round.name, round.circuit.name, round.circuit.country, round.raceStartsAt])];
  return new Response(rows.map(row => row.map(q).join(",")).join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=calendar-2026.csv" } });
}
