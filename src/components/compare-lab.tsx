"use client";

import { useState } from "react";
import { ComparisonOverview } from "@/components/comparison-overview";
import { PaceChart } from "@/components/pace-chart";
import { SeasonComparisonChart } from "@/components/season-comparison-chart";
import { message, type Locale } from "@/lib/i18n";
import { selectDriverPair } from "@/lib/compare";
import { getTeamColor } from "@/lib/team-colors";
import type { DriverTelemetrySnapshot, PaceChartData, SeasonComparisonSnapshot, SessionCode, Standing, StintSnapshot } from "@/lib/types";

function initialVsSelection(drivers: Standing[], pace: PaceChartData, requestedCodes: string[] = []) {
  return selectDriverPair(drivers.map(driver => driver.code), pace.defaultCodes ?? [], requestedCodes);
}

function initialSessionFilter(comparison: SeasonComparisonSnapshot): SessionCode | "ALL" {
  return comparison.sessions.some(session => session.sessionCode === "R" && session.results.length) ? "R" : "ALL";
}

export function CompareLab({ drivers, pace, comparison, stints, telemetryByDriver, locale, initialDriverCodes = [] }: { drivers: Standing[]; pace: PaceChartData; comparison: SeasonComparisonSnapshot; stints: StintSnapshot[]; telemetryByDriver?: Record<string, DriverTelemetrySnapshot>; locale: Locale; initialDriverCodes?: string[] }) {
  const [visibleDrivers, setVisibleDrivers] = useState(() => drivers.map(driver => driver.code));
  const [vsDrivers, setVsDrivers] = useState(() => initialVsSelection(drivers, pace, initialDriverCodes));
  const [activeVsSlot, setActiveVsSlot] = useState<0 | 1>(0);
  const [sessionFilter, setSessionFilter] = useState<SessionCode | "ALL">(() => initialSessionFilter(comparison));
  const [roundFilter, setRoundFilter] = useState("ALL");
  const [circuitFilter, setCircuitFilter] = useState("ALL");
  const hasSeasonResults = comparison.sessions.some(session => session.results.length > 0);
  const filteredSessions = comparison.sessions.filter(session => (sessionFilter === "ALL" || session.sessionCode === sessionFilter) && (roundFilter === "ALL" || String(session.round) === roundFilter) && (circuitFilter === "ALL" || session.circuit === circuitFilter));
  const filteredComparison: SeasonComparisonSnapshot = { ...comparison, sessions: filteredSessions };
  const visibleDriverRows = drivers.filter(driver => visibleDrivers.includes(driver.code));
  const selectedSeries = vsDrivers.map(code => pace.series.find(series => series.code === code)).filter((series): series is NonNullable<typeof series> => Boolean(series));
  const chartData: PaceChartData = { ...pace, series: selectedSeries, defaultCodes: selectedSeries.map(series => series.code) };
  const fastF1Status = pace.source === "FastF1" ? "FASTF1 · VALIDATED ARTIFACT" : "FASTF1 · PENDING";
  const vsProfiles = vsDrivers.map(code => drivers.find(driver => driver.code === code)).filter((driver): driver is Standing => Boolean(driver));
  const renderVsSlot = (driver: Standing | undefined, index: 0 | 1) => {
    if (!driver) return <div className="vs-driver-slot" aria-hidden="true"><span>DRIVER {index === 0 ? "A" : "B"}</span><strong>—</strong><small>Select a driver</small></div>;
    return <button type="button" className={`vs-driver-slot${activeVsSlot === index ? " selected" : ""}`} style={{ "--team-color": getTeamColor(driver.team, driver.color) } as React.CSSProperties} aria-pressed={activeVsSlot === index} onClick={() => setActiveVsSlot(index)}><span>DRIVER {index === 0 ? "A" : "B"}</span><strong>{driver.code}</strong><small>{driver.name} · {driver.team}</small></button>;
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
  const resetSelection = () => { setVisibleDrivers(drivers.map(driver => driver.code)); setVsDrivers(initialVsSelection(drivers, pace, initialDriverCodes)); setActiveVsSlot(0); setSessionFilter(initialSessionFilter(comparison)); setRoundFilter("ALL"); setCircuitFilter("ALL"); };
  const showAllDrivers = () => { setVisibleDrivers(drivers.map(driver => driver.code)); };
  const hideAllDrivers = () => { setVisibleDrivers([]); };
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
      <section className="vs-driver-picker" aria-labelledby="vs-driver-heading">
        <div className="vs-picker-heading"><div><div className="eyebrow" id="vs-driver-heading">VS ANALYSIS · 2 DRIVERS</div><p>Choose a slot, then select a driver. Deep-dive charts use this pair.</p></div><span>{vsDrivers.join(" · ")}</span></div>
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
    </section>

    <ComparisonOverview drivers={visibleDriverRows} sessions={filteredSessions} pace={pace} stints={stints} telemetryByDriver={telemetryByDriver} activeDrivers={vsDrivers} locale={locale} />

    <section className="panel compare-summary-panel">
      <div className="section-heading"><div><p className="eyebrow">{comparison.season} · {vsDrivers.join(" VS ")} · RESULT REFERENCE · {sessionFilter}</p><h2>{message(locale, "comparisonAllSessions")}</h2></div><p>{hasSeasonResults ? (comparison.source === "Jolpica" ? "JOLPICA · RESULTS" : "OPENF1 · SESSION_RESULT") : "RESULT DATA UNAVAILABLE"}</p></div>
      <SeasonComparisonChart comparison={filteredComparison} activeDrivers={vsDrivers} locale={locale} />
    </section>

    <section className="panel compare-pace-panel">
      <div className="section-heading"><div><p className="eyebrow">{vsDrivers.join(" VS ")} · {pace.sessionLabel}</p><h2>{message(locale, "comparisonLatestPace")}</h2></div><p>{fastF1Status} · {selectedSeries.length} DRIVERS · LAP-BY-LAP</p></div>
      <PaceChart data={chartData} />
    </section>
  </div>;
}
