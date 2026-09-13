"use client";

import Link from "next/link";
import { SeasonComparisonChart } from "./season-comparison-chart";
import { referenceSeasonSessions, seasonDriverStats } from "@/lib/cross-season";
import type { ComparisonFilters } from "@/lib/compare";
import type { SeasonComparisonSnapshot } from "@/lib/types";
import type { Locale } from "@/lib/i18n";

// Extend Compare's existing controls and chart language; keep each year's
// circuit sequence separate so matching round numbers never imply one venue.
export function CrossSeasonComparison({ primary, reference, filters, activeDrivers, locale }: { primary: SeasonComparisonSnapshot; reference: SeasonComparisonSnapshot; filters: ComparisonFilters; activeDrivers: string[]; locale: Locale }) {
  const years = [primary, { ...reference, sessions: referenceSeasonSessions(primary.sessions, reference.sessions, filters) }];
  const th = locale === "th";
  return <section className="panel cross-season-comparison">
    <div className="section-heading"><div><p className="eyebrow">{primary.season} / {reference.season}</p><h2>{th ? "เปรียบเทียบข้ามฤดูกาล" : "Compare seasons"}</h2></div></div>
    <p>{th ? "ใช้ผล session ที่จบแล้วตามตัวกรอง จำนวน session ของแต่ละปีอาจต่างกัน ค่าเฉลี่ยอันดับนับเฉพาะผลที่จัดอันดับได้ และไม่ถือว่ารอบสนามเลขเดียวกันเป็นสนามเดียวกัน" : "Completed session results within your filters. Season lengths may differ. Average position includes classified results only; matching round numbers do not imply the same circuit."}</p>
    <p>{th ? "กราฟนี้เปรียบเทียบผลและอันดับ ข้อมูล pace และ telemetry ด้านล่างเป็นของฤดูกาลหลัก" : "These charts compare results and positions. Pace and telemetry below belong to the primary season."}</p>
    <div className="table-scroll" tabIndex={0} role="region" aria-label={th ? "ตารางเทียบฤดูกาล" : "Season comparison table"}><table className="data-table"><thead><tr><th>{th ? "นักขับ" : "Driver"}</th><th>{th ? "ปี" : "Year"}</th><th>{th ? "ผลที่มี / session" : "Results / sessions"}</th><th>{th ? "คะแนนในขอบเขต" : "Points in scope"}</th><th>{th ? "อันดับเฉลี่ย" : "Avg. classified position"}</th></tr></thead><tbody>{activeDrivers.flatMap(code => years.map(year => {
      const stats = seasonDriverStats(year.sessions, code);
      const scopedCircuit = filters.circuit !== "ALL" ? filters.circuit : filters.round !== "ALL" ? primary.sessions[0]?.circuit : undefined;
      const scopedRound = year.season === primary.season ? filters.round : scopedCircuit ? year.sessions.find(session => session.circuit === scopedCircuit)?.round : undefined;
      const query = new URLSearchParams({ season: String(year.season), sessionCode: filters.session, circuit: scopedCircuit ?? "ALL", round: String(scopedRound ?? "ALL") });
      return <tr key={`${code}-${year.season}`}><th><Link href={`/drivers/${code.toLowerCase()}?${query}`}>{code}</Link></th><td>{year.season}</td><td>{stats.samples} / {year.sessions.length}</td><td>{stats.points ?? "—"}</td><td>{stats.averagePosition === undefined ? "—" : `P${stats.averagePosition.toFixed(2)} (${stats.classified})`}</td></tr>;
    }))}</tbody></table></div>
    <div className="cross-season-charts">{years.map(year => <article key={year.season}><h3>{year.season} · {year.sessions.length} {th ? "session" : "sessions"}</h3><p>{year.source}</p><SeasonComparisonChart comparison={year} activeDrivers={activeDrivers} locale={locale} /></article>)}</div>
  </section>;
}
