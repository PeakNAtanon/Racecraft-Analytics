type HistoryResponse = { source: "Jolpica" | "reference" | "fallback"; firstGrandPrix?: number; firstRaceName?: string; seasonDebut?: boolean };

interface CircuitHistoryCardProps {
  lengthKm: number;
  corners: number;
  builtYear?: number;
  history: HistoryResponse;
}

export function CircuitHistoryCard({ lengthKm, corners, builtYear, history }: CircuitHistoryCardProps) {
  const firstF1Year = history.firstGrandPrix ?? builtYear;
  const trackYear = builtYear ?? history.firstGrandPrix;

  return (
    <div className="circuit-history-link">
      <span className="eyebrow">CIRCUIT HISTORY · {history.source === "Jolpica" ? "API" : "REFERENCE"}</span>
      <div className="circuit-history-summary">
        <span><b>{firstF1Year ?? "N/A"}</b><small>{history.seasonDebut ? "SEASON DEBUT" : history.firstGrandPrix ? "FIRST GRAND PRIX" : "F1 DEBUT / OPENING"}</small></span>
        <span><b>{trackYear ?? "N/A"}</b><small>{builtYear ? "YEAR BUILT / OPENED" : "FIRST F1 RECORD"}</small></span>
        <span><b>{lengthKm.toFixed(3)} km</b><small>CIRCUIT LENGTH</small></span>
        <span><b>{corners}</b><small>CORNERS</small></span>
      </div>
      <span className="history-source">{history.firstRaceName ? `${history.firstRaceName}${history.seasonDebut ? " · FIRST F1 RECORD PENDING" : " · HISTORICAL RECORD"}` : history.source === "fallback" ? "NO HISTORICAL RECORD" : "HISTORICAL RECORD"}</span>
      <span className="link-arrow">VIEW FULL RECORD →</span>
    </div>
  );
}
