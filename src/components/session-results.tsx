import { message, type Locale } from "@/lib/i18n";
import { getTeamColor } from "@/lib/team-colors";
import type { SessionAnalyticsSnapshot, SessionResult } from "@/lib/types";

function ResultRow({ result, locale }: { result: SessionResult; locale: Locale }) {
  const color = getTeamColor(result.team, result.color);
  return <tr className={`session-result-row ${result.status.toLowerCase()}`} style={{ "--team-color": color } as React.CSSProperties}>
    <td className="rank">{result.position === undefined ? "—" : String(result.position).padStart(2, "0")}</td>
    <td><span className="driver-code"><span className="team-color-swatch" aria-hidden="true" />{result.code}</span><strong className="table-driver-name">{result.name}</strong></td>
    <td>{result.team}</td>
    <td><span className={`result-status ${result.status.toLowerCase()}`}>{result.status === "CLASSIFIED" ? message(locale, "complete") : result.status}</span></td>
    <td className="mono">{result.position === 1 ? result.time : result.gap}</td>
    <td className="mono">{result.laps ?? "—"}</td>
  </tr>;
}

export function SessionResults({ analytics, locale }: { analytics: SessionAnalyticsSnapshot; locale: Locale }) {
  const hasResults = analytics.results.length > 0;
  return <section className="section panel session-results" aria-labelledby="latest-session-results-title">
    <div className="section-heading">
      <div>
        <div className="eyebrow">{message(locale, "finalClassification")}</div>
        <h2 id="latest-session-results-title">{message(locale, "latestSessionResults")}</h2>
      </div>
      <p><span>{analytics.resultsSource === "OpenF1" ? "OPENF1 · SESSION_RESULT" : analytics.resultsSource === "Jolpica" ? "JOLPICA · RACE_RESULTS" : "PROVIDER DATA"}</span><br />{analytics.sessionName}<br /><small>{hasResults ? `${analytics.results.length} ${message(locale, "resultDriver").toLowerCase()}` : "AWAITING OFFICIAL DATA"}</small></p>
    </div>
    {hasResults ? <div className="table-scroll session-results-scroll"><table className="data-table" aria-label={`${message(locale, "sessionResults")}: ${analytics.sessionName}`}>
      <caption className="sr-only">{message(locale, "sessionResults")} · {analytics.sessionName}</caption>
      <thead><tr><th>Pos</th><th>{message(locale, "resultDriver")}</th><th>{message(locale, "resultTeam")}</th><th>{message(locale, "resultStatus")}</th><th>{message(locale, "resultGap")} / {message(locale, "resultTime")}</th><th>{message(locale, "resultLaps")}</th></tr></thead>
      <tbody>{analytics.results.map(result => <ResultRow key={result.driverNumber} result={result} locale={locale} />)}</tbody>
    </table></div> : <div className="empty session-results-empty">{message(locale, "noSessionResults")}</div>}
  </section>;
}
