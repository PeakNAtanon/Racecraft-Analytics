"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CrossSeasonComparison } from "@/components/cross-season-comparison";
import { analysisText as text } from "@/lib/analysis-copy";
import { ComparisonOverview } from "@/components/comparison-overview";
import { PaceChart } from "@/components/pace-chart";
import { SeasonComparisonChart } from "@/components/season-comparison-chart";
import { message, type Locale } from "@/lib/i18n";
import { filterComparisonSessions, selectDriverPair, type ComparisonFilters } from "@/lib/compare";
import { getTeamColor } from "@/lib/team-colors";
import type { DriverTelemetrySnapshot, PaceChartData, SeasonComparisonSnapshot, Standing, StintSnapshot } from "@/lib/types";

function initialVsSelection(drivers: Standing[], pace: PaceChartData, requestedCodes: string[] = []) {
  return selectDriverPair(drivers.map(driver => driver.code), pace.defaultCodes ?? [], requestedCodes);
}

export function CompareLab({ drivers, pace, comparison, referenceComparison, availableSeasons, stints, telemetryByDriver, locale, filters, initialDriverCodes = [] }: { drivers: Standing[]; pace: PaceChartData; comparison: SeasonComparisonSnapshot; referenceComparison?: SeasonComparisonSnapshot; availableSeasons: number[]; stints: StintSnapshot[]; telemetryByDriver?: Record<string, DriverTelemetrySnapshot>; locale: Locale; filters: ComparisonFilters; initialDriverCodes?: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [visibleDrivers, setVisibleDrivers] = useState(() => drivers.map(driver => driver.code));
  const [vsDrivers, setVsDrivers] = useState(() => initialVsSelection(drivers, pace, initialDriverCodes));
  const [activeVsSlot, setActiveVsSlot] = useState<0 | 1>(0);
  const { session: sessionFilter, round: roundFilter, circuit: circuitFilter } = filters;
  const updateFilters = (next: Partial<ComparisonFilters>) => {
    const query = new URLSearchParams({ ...filters, ...next, drivers: vsDrivers.join(","), season: String(comparison.season), ...(referenceComparison ? { compareSeason: String(referenceComparison.season) } : {}) });
    startTransition(() => router.replace(`/compare?${query}`, { scroll: false }));
  };
  const hasSeasonResults = comparison.sessions.some(session => session.results.length > 0);
  const filteredSessions = filterComparisonSessions(comparison.sessions, filters);
  const filteredComparison: SeasonComparisonSnapshot = { ...comparison, sessions: filteredSessions };
  const visibleDriverRows = drivers.filter(driver => visibleDrivers.includes(driver.code));
  const selectedSeries = vsDrivers.map(code => pace.series.find(series => series.code.toUpperCase() === code.toUpperCase())).filter((series): series is NonNullable<typeof series> => Boolean(series));
  const chartData: PaceChartData = { ...pace, series: selectedSeries, defaultCodes: selectedSeries.map(series => series.code) };
  const fastF1Status = pace.source === "FastF1" ? text(locale, "FASTF1 · VALIDATED ARTIFACT") : text(locale, "FASTF1 · PENDING");
  const vsProfiles = vsDrivers.map(code => drivers.find(driver => driver.code === code)).filter((driver): driver is Standing => Boolean(driver));
  const renderVsSlot = (driver: Standing | undefined, index: 0 | 1) => {
    if (!driver) return <div className="vs-driver-slot" aria-hidden="true"><span>{text(locale, "DRIVER")} {index === 0 ? "A" : "B"}</span><strong>—</strong><small>{text(locale, "Select a driver")}</small></div>;
    return <button type="button" className={`vs-driver-slot${activeVsSlot === index ? " selected" : ""}`} style={{ "--team-color": getTeamColor(driver.team, driver.color) } as React.CSSProperties} aria-pressed={activeVsSlot === index} onClick={() => setActiveVsSlot(index)}><span>{text(locale, "DRIVER")} {index === 0 ? "A" : "B"}</span><strong>{driver.code}</strong><small>{driver.name} · {driver.team}</small></button>;
  };
  const toggleVisibleDriver = (code: string) => {
    setVisibleDrivers(current => {
      return current.includes(code) ? current.filter(item => item !== code) : [...current, code];
    });
  };
  const selectVsDriver = (code: string) => {
    const existingSlot = vsDrivers.indexOf(code);
    if (existingSlot >= 0) {
      setActiveVsSlot(existingSlot as 0 | 1);
      return;
    }
    setVsDrivers(current => {
      if (current.length < 2) return [...current, code];
      const next = [...current];
      next[activeVsSlot] = code;
      return next;
    });
  };
  const resetSelection = () => { setVisibleDrivers(drivers.map(driver => driver.code)); setActiveVsSlot(0); updateFilters({ session: "ALL", round: "ALL", circuit: "ALL" }); };
  const showAllDrivers = () => { setVisibleDrivers(drivers.map(driver => driver.code)); };
  const hideAllDrivers = () => { setVisibleDrivers([]); };
  const rounds = Array.from(new Set(comparison.sessions.map(session => session.round).filter(round => round > 0))).sort((a, b) => a - b);
  const circuits = Array.from(new Set(comparison.sessions.map(session => session.circuit).filter(Boolean))).sort();

  return <div className="compare-lab">
    <section className="panel compare-control-panel">
      <form className="season-compare-controls" method="get" aria-label={locale === "th" ? "เลือกฤดูกาล" : "Choose seasons"}>
        <input type="hidden" name="drivers" value={vsDrivers.join(",")} />
        {Object.entries(filters).map(([name, value]) => <input key={name} type="hidden" name={name} defaultValue={value} />)}
        <label>{locale === "th" ? "ฤดูกาลหลัก" : "Primary season"}<select className="select" name="season" defaultValue={comparison.season} onChange={event => { for (const name of ["round", "circuit", "session"]) { const control = event.currentTarget.form?.elements.namedItem(name); if (control instanceof HTMLInputElement) control.value = "ALL"; } }}>{availableSeasons.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>{locale === "th" ? "เทียบกับฤดูกาล" : "Compare with season"}<select className="select" name="compareSeason" defaultValue={referenceComparison?.season ?? ""}><option value="">{locale === "th" ? "ไม่เปรียบเทียบ" : "Single season"}</option>{availableSeasons.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
        <button className="button" type="submit">{locale === "th" ? "แสดงข้อมูล" : "Show seasons"}</button>
      </form>
      <details className="analysis-guide"><summary>{text(locale, "Guide")} · FastF1</summary><p>{text(locale, "Clean-lap pace excludes pit laps, deleted laps and laps that fail accuracy or track-status checks.")}</p><p>{text(locale, "Consistency measures lap-time variation; lower means more consistent. Theoretical best sums the best validated sectors, not an actual completed lap.")}</p></details>
      <div className="compare-filter-bar">
        <label>{text(locale, "SESSION TYPE")}<select className="select" disabled={isPending} value={sessionFilter} onChange={event => updateFilters({ session: event.target.value })}><option value="ALL">{text(locale, "ALL SESSION TYPES")}</option><option value="R">{text(locale, "RACE")}</option><option value="Q">{text(locale, "QUALIFYING")}</option><option value="SPR">{text(locale, "SPRINT")}</option><option value="SQ">{text(locale, "SPRINT QUALIFYING")}</option><option value="FP1">{text(locale, "PRACTICE 1")}</option><option value="FP2">{text(locale, "PRACTICE 2")}</option><option value="FP3">{text(locale, "PRACTICE 3")}</option></select></label>
        <label>{text(locale, "ROUND")}<select className="select" disabled={isPending} value={roundFilter} onChange={event => updateFilters({ round: event.target.value })}><option value="ALL">{text(locale, "ALL ROUNDS")}</option>{rounds.map(round => <option key={round} value={round}>{text(locale, "ROUND")} {String(round).padStart(2, "0")}</option>)}</select></label>
        <label>{text(locale, "CIRCUIT")}<select className="select" disabled={isPending} value={circuitFilter} onChange={event => updateFilters({ circuit: event.target.value })}><option value="ALL">{text(locale, "ALL CIRCUITS")}</option>{circuits.map(circuit => <option key={circuit} value={circuit}>{circuit}</option>)}</select></label>
        <div className="compare-actions" aria-label="Compare view actions"><button type="button" className="button button-secondary" disabled={isPending} onClick={resetSelection}>{text(locale, "RESET")}</button></div>
      </div>
      <section className="vs-driver-picker" aria-labelledby="vs-driver-heading">
        <div className="vs-picker-heading"><div><div className="eyebrow" id="vs-driver-heading">{text(locale, "VS ANALYSIS · 2 DRIVERS")}</div><p>{text(locale, "Choose a slot, then select a driver. Deep-dive charts use this pair.")}</p></div><span>{vsDrivers.join(" · ")}</span></div>
        <div className="vs-driver-slots" role="group" aria-label="Driver versus pair">
          {renderVsSlot(vsProfiles[0], 0)}
          <span className="vs-divider" aria-hidden="true">VS</span>
          {renderVsSlot(vsProfiles[1], 1)}
        </div>
        <div className="driver-picker-grid vs-driver-grid">
          {drivers.map(driver => {
            const selected = vsDrivers.includes(driver.code);
            return <button key={driver.code} type="button" className={`driver-chip focus-chip${selected ? " selected" : ""}`} style={{ "--team-color": getTeamColor(driver.team, driver.color) } as React.CSSProperties} aria-pressed={selected} onClick={() => selectVsDriver(driver.code)}><span>{driver.code}</span><small>{driver.name}</small></button>;
          })}
        </div>
      </section>
      <details className="compare-display-options"><summary>{text(locale, "More display options")}</summary>
      <fieldset className="driver-picker">
        <legend>{text(locale, "FIELD VISIBILITY")} · {visibleDrivers.length}/{drivers.length}</legend>
        <div className="analysis-state-actions"><button type="button" className="button button-secondary" onClick={showAllDrivers}>{text(locale, "SHOW ALL")}</button><button type="button" className="button button-secondary" onClick={hideAllDrivers}>{text(locale, "HIDE ALL")}</button></div>
        <div className="driver-picker-grid">
          {drivers.map(driver => {
            const selected = visibleDrivers.includes(driver.code);
            return <button key={driver.code} type="button" className={`driver-chip${selected ? " selected" : ""}`} style={{ "--team-color": getTeamColor(driver.team, driver.color) } as React.CSSProperties} aria-pressed={selected} onClick={() => toggleVisibleDriver(driver.code)}>
              <span>{driver.code}</span><small>{driver.name}</small>
            </button>;
          })}
        </div>
        <p className="form-helper">{message(locale, "comparisonHint")}</p>
      </fieldset>
      </details>
    </section>

    <div className="panel analysis-state-actions">{vsDrivers.map(code => <Link className="button-secondary" key={code} href={`/drivers/${code.toLowerCase()}?${new URLSearchParams({ season: String(comparison.season), round: roundFilter, circuit: circuitFilter, sessionCode: sessionFilter })}`}>{code} · {comparison.season} · {locale === "th" ? "กราฟนักขับ" : "Driver analysis"}</Link>)}</div>
    {isPending ? <p role="status">{text(locale, "Loading analysis for the selected filters…")}</p> : <>
    {referenceComparison && <CrossSeasonComparison primary={filteredComparison} reference={referenceComparison} filters={filters} activeDrivers={vsDrivers} locale={locale} />}
    <ComparisonOverview drivers={visibleDriverRows} sessions={filteredSessions} pace={pace} stints={stints} telemetryByDriver={telemetryByDriver} activeDrivers={vsDrivers} locale={locale} />

    <section className="panel compare-summary-panel">
      <div className="section-heading"><div><p className="eyebrow">{comparison.season} · {vsDrivers.join(" VS ")} {text(locale, "· RESULT REFERENCE ·")} {sessionFilter}</p><h2>{message(locale, "comparisonAllSessions")}</h2></div><p>{hasSeasonResults ? (comparison.source === "Jolpica" ? "JOLPICA · RESULTS" : "OPENF1 · SESSION_RESULT") : text(locale, "RESULT DATA UNAVAILABLE")}</p></div>
      <SeasonComparisonChart comparison={filteredComparison} activeDrivers={vsDrivers} locale={locale} />
    </section>

    <section className="panel compare-pace-panel">
      <div className="section-heading"><div><p className="eyebrow">{vsDrivers.join(" VS ")} · {pace.sessionLabel}</p><h2>{message(locale, "comparisonLatestPace")}</h2></div><p>{fastF1Status} · {selectedSeries.length} {text(locale, "DRIVERS · LAP-BY-LAP")}</p></div>
      <PaceChart data={chartData} locale={locale} />
    </section>
    </>}
  </div>;
}
