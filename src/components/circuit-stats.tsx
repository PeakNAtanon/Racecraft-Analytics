import type { Circuit, CircuitStats } from "@/lib/types";

interface CircuitStatsProps {
  circuit: Circuit;
  stats: CircuitStats;
}

function lengthLabel(value: number | undefined) {
  return value === undefined ? "—" : value.toFixed(3) + " km";
}

function numberLabel(value: number | undefined) {
  return value === undefined ? "—" : String(value);
}

export function CircuitStatsPanel({ circuit, stats }: CircuitStatsProps) {
  const fastestMeta = stats.fastestLap ? stats.fastestLap.driver + (stats.fastestLap.year ? " (" + stats.fastestLap.year + ")" : "") : "Provider record unavailable";
  const sourceLabel = stats.source === "Jolpica" ? "JOLPICA · HISTORICAL RESULTS" : "JOLPICA · AWAITING RECORD";
  const historyYear = circuit.builtYear ?? stats.firstGrandPrix;
  const historyYearLabel = circuit.builtYear ? "YEAR BUILT / OPENED" : "FIRST F1 RECORD";

  return (
    <section id="circuit-history" className="section panel circuit-spec-panel" aria-labelledby="circuit-spec-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">CIRCUIT PROFILE · API DATA</div>
          <h2 id="circuit-spec-title">Circuit history & specifications</h2>
        </div>
        <p>
          <span>{sourceLabel}</span>
          <br />{circuit.name}<br /><small>{historyYearLabel} · {numberLabel(historyYear)}</small>
        </p>
      </div>

      <dl className="circuit-spec-grid">
        <div className="circuit-spec-stat">
          <dt>CIRCUIT LENGTH</dt>
          <dd>{lengthLabel(circuit.lengthKm)}</dd>
        </div>
        <div className="circuit-spec-stat">
          <dt>FIRST GRAND PRIX / F1 DEBUT</dt>
          <dd>{numberLabel(stats.firstGrandPrix ?? circuit.builtYear)}</dd>
        </div>
        <div className="circuit-spec-stat">
          <dt>NUMBER OF LAPS</dt>
          <dd>{numberLabel(stats.numberOfLaps)}</dd>
        </div>
        <div className="circuit-spec-stat circuit-spec-record">
          <dt>FASTEST LAP TIME</dt>
          <dd>{stats.fastestLap?.time ?? "—"}<small>{fastestMeta}</small></dd>
        </div>
        <div className="circuit-spec-stat">
          <dt>RACE DISTANCE</dt>
          <dd>{lengthLabel(stats.raceDistanceKm)}</dd>
        </div>
      </dl>
    </section>
  );
}