import { getSeasonStandings } from "@/lib/data-api";

const q = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;

export async function GET() {
  const snapshot = await getSeasonStandings();
  const rows = [["season", "round", "position", "code", "driver", "team", "wins", "points"], ...snapshot.standings.map(standing => [snapshot.season, snapshot.round, standing.position, standing.code, standing.name, standing.team, standing.wins, standing.points])];
  return new Response(rows.map(row => row.map(q).join(",")).join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=driver-standings.csv" } });
}
