import Link from "next/link";
import { PageHead, StatusBadge } from "@/components/shared";
import { getSeasonComparison, getSeasonStandings } from "@/lib/data-api";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";
import { getTeamColor, getTeamMark } from "@/lib/team-colors";

export const revalidate = 600;

function latestForm(code: string, sessions: Awaited<ReturnType<typeof getSeasonComparison>>["sessions"]) {
  return sessions.filter((session) => session.sessionCode === "R" || session.sessionCode === "SPR").flatMap((session) => {
    const result = session.results.find((item) => item.code === code);
    return result?.status !== "CLASSIFIED" || result.position === undefined ? [] : [result.position];
  }).slice(-3);
}

export default async function Drivers({ searchParams }: { searchParams?: Promise<{ season?: string | string[] }> }) {
  const query = await searchParams;
  const seasonValue = Array.isArray(query?.season) ? query?.season[0] : query?.season;
  const season = Number.isInteger(Number(seasonValue)) && Number(seasonValue) > 0 ? Number(seasonValue) : Number(process.env.F1_SEASON ?? "2026");
  const [snapshot, comparison, locale] = await Promise.all([getSeasonStandings(season), getSeasonComparison(season), getLocale()]);

  const snapshotSource = snapshot.source === "Jolpica" ? snapshot.complete ? "JOLPICA API" : "JOLPICA API · PARTIAL" : "CACHED FALLBACK";
  const leader = snapshot.standings[0];
  return <>
    <PageHead eyebrow="DRIVER ANALYSIS" title="Driver Analysis">{message(locale, "driversDescription")}</PageHead>

    <section className="driver-hub-toolbar panel" aria-label="Driver analysis controls">
      <div>
        <div className="eyebrow">{snapshot.season} · ANALYSIS WORKSPACE</div>
        <p>Jolpica supplies the championship field. FastF1 supplies validated deep analysis inside each driver profile.</p>
      </div>
      <form action="/drivers" method="get" className="driver-season-form">
        <label htmlFor="driver-season">SEASON</label>
        <div className="driver-season-form-row">
          <input id="driver-season" className="select" type="number" name="season" min="1950" max="2100" inputMode="numeric" defaultValue={season} />
          <button className="button" type="submit">LOAD</button>
        </div>
      </form>
    </section>

    <section className="section driver-analysis-summary" aria-label="Driver analysis data summary">
      <article><span>DRIVERS</span><strong>{snapshot.standings.length}</strong><small>championship field · {snapshotSource}</small></article>
      <article><span>SESSIONS INDEXED</span><strong>{comparison.sessions.length}</strong><small>completed provider sessions</small></article>
      <article><span>LEADER</span><strong>{leader?.code ?? "—"}</strong><small>{leader?.name ?? "No standings data"}</small></article>
      <article><span>DEEP ANALYSIS</span><strong>FASTF1</strong><small>validated artifact when ready</small></article>
    </section>

    <section className="section">
      <div className="section-heading">
        <div><div className="eyebrow">DRIVER FIELD · 22 MAX</div><h2>Choose a driver to inspect</h2></div>
        <p>OPEN DRIVER ANALYSIS →</p>
      </div>
      <div className="driver-analysis-grid-hub">
        {snapshot.standings.map((driver) => {
          const color = getTeamColor(driver.team, driver.color);
          const form = latestForm(driver.code, comparison.sessions);
          return <Link href={`/drivers/${driver.code.toLowerCase()}`} className="driver-analysis-card-link" key={driver.code} style={{ "--driver-color": color } as React.CSSProperties}>
            <article className="driver-analysis-card-hub">
              <div className="driver-hub-top"><span>P{String(driver.position).padStart(2, "0")}</span><StatusBadge status={snapshot.source === "Jolpica" && snapshot.complete ? "complete" : "provisional"} /></div>
              <div className="driver-hub-identity"><div className="team-mark" aria-hidden="true">{getTeamMark(driver.team)}</div><div><h3>{driver.name}</h3><p><b>{driver.code}</b> · {driver.team}</p></div></div>
              <div className="driver-hub-stats"><span><small>POINTS</small><strong>{driver.points ?? "—"}</strong></span><span><small>WINS</small><strong>{driver.wins ?? "—"}</strong></span><span><small>LAST FORM</small><strong>{form.length ? form.map((position) => `P${position}`).join(" · ") : "—"}</strong></span></div>
              <span className="link-arrow">VIEW DRIVER ANALYSIS →</span>
            </article>
          </Link>;
        })}
      </div>
    </section>
  </>;
}
