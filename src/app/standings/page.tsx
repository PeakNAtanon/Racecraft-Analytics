import { PageHead, DriverGrid } from "@/components/shared";
import { getSeasonStandings } from "@/lib/data-api";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";
import { getTeamColor, getTeamMark } from "@/lib/team-colors";

export default async function Standings() {
  const [snapshot, locale] = await Promise.all([getSeasonStandings(), getLocale()]);
  const standings = snapshot.standings;
  const snapshotLabel = snapshot.round > 0
    ? `${snapshot.season} · AFTER ROUND ${String(snapshot.round).padStart(2, "0")}`
    : `${snapshot.season} · LOCAL FALLBACK`;

  return (
    <>
      <PageHead eyebrow="CHAMPIONSHIP" title="Standings">{message(locale, "standingsDescription")}</PageHead>

      <section className="section standings-feature">
        <div className="section-heading">
          <div>
            <div className="eyebrow">DRIVER GRID</div>
            <h2>The names in the fight</h2>
          </div>
          <p>
            <span>UPDATED SNAPSHOT</span>
            <br />
            {snapshotLabel}
            <br />
            <small>{snapshot.source === "Jolpica" ? snapshot.complete ? "JOLPICA API" : "JOLPICA API · PARTIAL" : "CACHED FALLBACK"}</small>
          </p>
        </div>
        <DriverGrid drivers={standings} />
      </section>

      <section className="section panel standings-table-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FULL CLASSIFICATION</div>
            <h2>Complete table · {standings.length} drivers</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Pos</th><th>Driver</th><th>Team</th><th>Wins</th><th>Points</th></tr>
            </thead>
            <tbody>
              {standings.map((standing) => (
                <tr key={standing.code} id={`row-${standing.code.toLowerCase()}`} style={{ "--team-color": getTeamColor(standing.team, standing.color) } as React.CSSProperties}>
                  <td className="rank">{String(standing.position).padStart(2, "0")}</td>
                  <td><span className="driver-code"><span className="team-color-swatch" aria-hidden="true" />{standing.code}</span><strong className="table-driver-name">{standing.name}</strong></td>
                  <td><span className="table-team-cell"><span className="table-team-mark" aria-hidden="true">{getTeamMark(standing.team)}</span><span className="team-color-swatch" aria-hidden="true" />{standing.team}</span></td>
                  <td className="mono">{standing.wins ?? "—"}</td>
                  <td className="mono"><b>{standing.points ?? "—"}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
