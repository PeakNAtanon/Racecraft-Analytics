import Link from "next/link";
import { DriverDirectoryControls, type DriverDirectorySort } from "@/components/driver-directory-controls";
import { PageHead, StatusBadge } from "@/components/shared";
import { getSeasonComparison, getSeasonStandings } from "@/lib/data-api";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";
import { getTeamColor, getTeamMark } from "@/lib/team-colors";

export const revalidate = 600;

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function latestForm(code: string, sessions: Awaited<ReturnType<typeof getSeasonComparison>>["sessions"]) {
  return sessions.filter((session) => session.sessionCode === "R" || session.sessionCode === "SPR").flatMap((session) => {
    const result = session.results.find((item) => item.code === code);
    return result?.status !== "CLASSIFIED" || result.position === undefined ? [] : [{
      position: result.position,
      circuit: session.circuit,
      round: session.round,
      sessionCode: session.sessionCode,
    }];
  }).slice(-3).reverse();
}

export default async function Drivers({ searchParams }: { searchParams?: Promise<{ season?: string | string[]; q?: string | string[]; team?: string | string[]; sort?: string | string[] }> }) {
  const query = await searchParams;
  const seasonValue = firstQueryValue(query?.season);
  const season = Number.isInteger(Number(seasonValue)) && Number(seasonValue) > 0 ? Number(seasonValue) : Number(process.env.F1_SEASON ?? "2026");
  const [snapshot, comparison, locale] = await Promise.all([getSeasonStandings(season), getSeasonComparison(season), getLocale()]);

  const snapshotSource = snapshot.source === "Jolpica" ? snapshot.complete ? "JOLPICA API" : "JOLPICA API · PARTIAL" : "CACHED FALLBACK";
  const leader = snapshot.standings[0];
  const search = firstQueryValue(query?.q).trim();
  const selectedTeam = firstQueryValue(query?.team).trim();
  const requestedSort = firstQueryValue(query?.sort) as DriverDirectorySort;
  const sort: DriverDirectorySort = ["championship", "points", "wins", "team"].includes(requestedSort) ? requestedSort : "championship";
  const teams = Array.from(new Set(snapshot.standings.map((driver) => driver.team).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  const latestSeason = Number(process.env.F1_SEASON ?? "2026");
  const availableSeasons = Array.from({ length: Math.max(latestSeason - 1950 + 1, 1) }, (_, index) => latestSeason - index);
  const seatCount = teams.length * 2;
  const normalizedSearch = search.toLocaleLowerCase();
  const visibleDrivers = snapshot.standings.filter((driver) => {
    const matchesSearch = !normalizedSearch || [driver.code, driver.name, driver.team].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
    const matchesTeam = !selectedTeam || driver.team === selectedTeam;
    return matchesSearch && matchesTeam;
  }).sort((left, right) => {
    if (sort === "points") return (right.points ?? -1) - (left.points ?? -1) || left.position - right.position;
    if (sort === "wins") return (right.wins ?? -1) - (left.wins ?? -1) || left.position - right.position;
    if (sort === "team") return left.team.localeCompare(right.team) || left.position - right.position;
    return left.position - right.position;
  });
  const directoryStatus = snapshot.source === "Jolpica" && snapshot.complete ? "complete" : "provisional";
  return <div className="driver-directory-page">
    <PageHead eyebrow="DRIVER ANALYSIS" title="Driver Analysis">{message(locale, "driversDescription")}</PageHead>

    <section className="driver-hub-toolbar panel" aria-label="Driver analysis controls">
      <div>
        <div className="eyebrow">{snapshot.season} · ANALYSIS WORKSPACE</div>
        <p>Jolpica supplies the championship field. FastF1 supplies validated deep analysis inside each driver profile.</p>
      </div>
      <form action="/drivers" method="get" className="driver-season-form">
        <label htmlFor="driver-season">SEASON</label>
        <div className="driver-season-form-row">
          <select id="driver-season" className="select" name="season" defaultValue={season}>
            {!availableSeasons.includes(season) ? <option value={season}>{season}</option> : null}
            {availableSeasons.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className="button" type="submit">LOAD</button>
        </div>
      </form>
    </section>

    <section className="section driver-analysis-summary" aria-label="Driver analysis data summary">
      <article><span>SEASON PARTICIPANTS</span><strong>{snapshot.standings.length}</strong><small>{teams.length} teams · {seatCount} current seats</small></article>
      <article><span>SESSIONS INDEXED</span><strong>{comparison.sessions.length}</strong><small>completed provider sessions</small></article>
      <article><span>LEADER</span><strong>{leader?.code ?? "—"}</strong><small>{leader?.name ?? "No standings data"}</small></article>
      <article><span>DEEP ANALYSIS</span><strong>FASTF1</strong><small>validated artifact when ready</small></article>
    </section>

    <section className="section">
      <div className="section-heading">
        <div><div className="eyebrow">CHAMPIONSHIP FIELD · {snapshot.standings.length} LISTED</div><h2>Choose a driver to inspect</h2></div>
        <p className="driver-directory-status"><StatusBadge status={directoryStatus} /> {snapshotSource}</p>
      </div>
      <DriverDirectoryControls season={season} teams={teams} initialSearch={search} initialTeam={selectedTeam} initialSort={sort} visibleCount={visibleDrivers.length} totalCount={snapshot.standings.length} />
      <div className="driver-analysis-grid-hub">
        {visibleDrivers.map((driver) => {
          const color = getTeamColor(driver.team, driver.color);
          const form = latestForm(driver.code, comparison.sessions);
          const formLabel = form.length ? form.map((item) => `${item.circuit} ${item.sessionCode}: P${item.position}`).join(", ") : "No classified Race or Sprint results available";
          return <article className="driver-analysis-card-link driver-analysis-card-hub" key={driver.code} style={{ "--driver-color": color } as React.CSSProperties}>
              <div className="driver-hub-top"><span>P{String(driver.position).padStart(2, "0")}</span><span>{driver.code}</span></div>
              <div className="driver-hub-identity"><div className="team-mark" aria-hidden="true">{getTeamMark(driver.team)}</div><div><h3><Link href={`/drivers/${driver.code.toLowerCase()}`}>{driver.name}</Link></h3><p><b>{driver.code}</b> · {driver.team}</p></div></div>
              <div className="driver-hub-stats"><span><small>POINTS</small><strong>{driver.points ?? "—"}</strong></span><span><small>WINS</small><strong>{driver.wins ?? "—"}</strong></span><span className="driver-latest-form"><small>LAST 3 · NEWEST FIRST</small><strong title={formLabel} aria-label={formLabel}>{form.length ? form.map((item) => <i key={`${item.round}-${item.sessionCode}`}><b>R{String(item.round).padStart(2, "0")}</b> P{item.position}</i>) : "—"}</strong></span></div>
              <div className="driver-card-actions"><Link href={`/drivers/${driver.code.toLowerCase()}`} className="link-arrow">VIEW ANALYSIS →</Link><Link href={`/compare?drivers=${encodeURIComponent(driver.code)}`} className="driver-compare-link">COMPARE ↗</Link></div>
          </article>;
        })}
        {!visibleDrivers.length ? <div className="driver-directory-empty"><strong>No drivers found</strong><p>Try another name, code or team, then apply the filters again.</p><Link href={`/drivers?season=${season}`} className="button-secondary">CLEAR FILTERS</Link></div> : null}
      </div>
    </section>
  </div>;
}
