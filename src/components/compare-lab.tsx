"use client";

import { useState } from "react";
import { ComparisonOverview } from "@/components/comparison-overview";
import { PaceChart } from "@/components/pace-chart";
import { SeasonComparisonChart } from "@/components/season-comparison-chart";
import { message, type Locale } from "@/lib/i18n";
import { getTeamColor } from "@/lib/team-colors";
import type { PaceChartData, SeasonComparisonSnapshot, SessionCode, Standing, StintSnapshot } from "@/lib/types";

function initialSelection(drivers: Standing[], pace: PaceChartData, requestedCodes: string[] = []) {
  const requested = requestedCodes.filter(code => drivers.some(driver => driver.code === code));
  const preferred = pace.defaultCodes?.filter(code => drivers.some(driver => driver.code === code)) ?? [];
  return Array.from(new Set([...requested, ...preferred, ...drivers.map(driver => driver.code)])).slice(0, 4);
}

function initialSessionFilter(comparison: SeasonComparisonSnapshot): SessionCode | "ALL" {
  return comparison.sessions.some(session => session.sessionCode === "R" && session.results.length) ? "R" : "ALL";
}

export function CompareLab({ drivers, pace, comparison, stints, locale, initialDriverCodes = [] }: { drivers: Standing[]; pace: PaceChartData; comparison: SeasonComparisonSnapshot; stints: StintSnapshot[]; locale: Locale; initialDriverCodes?: string[] }) {
  const [visibleDrivers, setVisibleDrivers] = useState(() => drivers.map(driver => driver.code));
  const [activeDrivers, setActiveDrivers] = useState(() => initialSelection(drivers, pace, initialDriverCodes));
  const [sessionFilter, setSessionFilter] = useState<SessionCode | "ALL">(() => initialSessionFilter(comparison));
  const [roundFilter, setRoundFilter] = useState("ALL");
  const [circuitFilter, setCircuitFilter] = useState("ALL");
  const hasSeasonResults = comparison.sessions.some(session => session.results.length > 0);
  const filteredSessions = comparison.sessions.filter(session => (sessionFilter === "ALL" || session.sessionCode === sessionFilter) && (roundFilter === "ALL" || String(session.round) === roundFilter) && (circuitFilter === "ALL" || session.circuit === circuitFilter));
  const filteredComparison: SeasonComparisonSnapshot = { ...comparison, sessions: filteredSessions };
  const visibleDriverRows = drivers.filter(driver => visibleDrivers.includes(driver.code));
  const selectedMinimum = Math.min(2, drivers.length);
  const selectedSeries = activeDrivers.map(code => pace.series.find(series => series.code === code)).filter((series): series is NonNullable<typeof series> => Boolean(series));
  const chartData: PaceChartData = { ...pace, series: selectedSeries, defaultCodes: selectedSeries.map(series => series.code) };
  const fastF1Status = pace.source === "FastF1" ? "FASTF1 · VALIDATED ARTIFACT" : "FASTF1 · PENDING";
  const toggleVisibleDriver = (code: string) => {
    setVisibleDrivers(current => {
      const next = current.includes(code) ? current.filter(item => item !== code) : [...current, code];
      setActiveDrivers(selected => selected.filter(item => next.includes(item)));
      return next;
    });
  };
  const toggleDriver = (code: string) => {
    setActiveDrivers(current => {
      if (current.includes(code)) return current.length > selectedMinimum ? current.filter(item => item !== code) : current;
      return current.length < 4 ? [...current, code] : current;
    });
  };
  const resetSelection = () => { setVisibleDrivers(drivers.map(driver => driver.code)); setActiveDrivers(initialSelection(drivers, pace, initialDriverCodes)); setSessionFilter(initialSessionFilter(comparison)); setRoundFilter("ALL"); setCircuitFilter("ALL"); };
  const showAllDrivers = () => { setVisibleDrivers(drivers.map(driver => driver.code)); setActiveDrivers(current => current.length ? current : initialSelection(drivers, pace, initialDriverCodes)); };
  const hideAllDrivers = () => { setVisibleDrivers([]); setActiveDrivers([]); };
  const rounds = Array.from(new Set(comparison.sessions.map(session => session.round).filter(round => round > 0))).sort((a, b) => a - b);
  const circuits = Array.from(new Set(comparison.sessions.map(session => session.circuit).filter(Boolean))).sort();

  return <div className="compare-lab">
    <section className="panel compare-control-panel">
      <div className="notice" role="note"><strong>FASTF1 PRIMARY ANALYSIS</strong><br />Pace, consistency, tyre degradation, strategy and telemetry are read only from validated FastF1 worker artifacts. Jolpica/OpenF1 remain result and session references; they are not substituted into analysis charts.</div>
      <div className="compare-filter-bar">
        <label>SESSION TYPE<select className="select" value={sessionFilter} onChange={event => setSessionFilter(event.target.value as SessionCode | "ALL")}><option value="ALL">ALL SESSION TYPES</option><option value="R">RACE</option><option value="Q">QUALIFYING</option><option value="SPR">SPRINT</option><option value="SQ">SPRINT QUALIFYING</option><option value="FP1">PRACTICE 1</option><option value="FP2">PRACTICE 2</option><option value="FP3">PRACTICE 3</option></select></label>
        <label>ROUND<select className="select" value={roundFilter} onChange={event => setRoundFilter(event.target.value)}><option value="ALL">ALL ROUNDS</option>{rounds.map(round => <option key={round} value={round}>ROUND {String(round).padStart(2, "0")}</option>)}</select></label>
        <label>CIRCUIT<select className="select" value={circuitFilter} onChange={event => setCircuitFilter(event.target.value)}><option value="ALL">ALL CIRCUITS</option>{circuits.map(circuit => <option key={circuit} value={circuit}>{circuit}</option>)}</select></label>
        <div className="compare-actions" aria-label="Compare view actions"><button type="button" className="button button-secondary" onClick={resetSelection}>RESET</button><button type="button" className="button button-secondary" onClick={showAllDrivers}>SHOW ALL</button><button type="button" className="button button-secondary" onClick={hideAllDrivers}>HIDE ALL</button></div>
      </div>
      <fieldset className="driver-picker">
        <legend>FIELD VISIBILITY · {visibleDrivers.length}/{drivers.length}</legend>
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
      <details className="focus-driver-picker"><summary className="chart-table-toggle">FOCUS 2–4 DRIVERS FOR DEEP DIVE · {activeDrivers.length}/4</summary><div className="driver-picker-grid">{drivers.map(driver => { const selected = activeDrivers.includes(driver.code); const locked = selected && activeDrivers.length <= selectedMinimum; const full = !selected && activeDrivers.length >= 4; return <button key={driver.code} type="button" className={`driver-chip focus-chip${selected ? " selected" : ""}`} style={{ "--team-color": getTeamColor(driver.team, driver.color) } as React.CSSProperties} aria-pressed={selected} disabled={locked || full} onClick={() => toggleDriver(driver.code)}><span>{driver.code}</span><small>{driver.name}</small></button>; })}</div></details>
    </section>

    <ComparisonOverview drivers={visibleDriverRows} sessions={filteredSessions} pace={pace} stints={stints} activeDrivers={activeDrivers} locale={locale} />

    <section className="panel compare-summary-panel">
      <div className="section-heading"><div><p className="eyebrow">{comparison.season} · RESULT REFERENCE · {sessionFilter}</p><h2>{message(locale, "comparisonAllSessions")}</h2></div><p>{hasSeasonResults ? (comparison.source === "Jolpica" ? "JOLPICA · RESULTS" : "OPENF1 · SESSION_RESULT") : "RESULT DATA UNAVAILABLE"}</p></div>
      <SeasonComparisonChart comparison={filteredComparison} activeDrivers={activeDrivers} locale={locale} />
    </section>

    <section className="panel compare-pace-panel">
      <div className="section-heading"><div><p className="eyebrow">{pace.sessionLabel}</p><h2>{message(locale, "comparisonLatestPace")}</h2></div><p>{fastF1Status} · {selectedSeries.length} DRIVERS · LAP-BY-LAP</p></div>
      <PaceChart data={chartData} />
    </section>
  </div>;
}
