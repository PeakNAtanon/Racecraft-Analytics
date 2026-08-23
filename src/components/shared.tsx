import Link from "next/link";
import { CountryFlag } from "@/components/country-flag";
import { message, type Locale } from "@/lib/i18n";
import { getTeamColor, getTeamMark } from "@/lib/team-colors";
import { displayTimezone, timezoneShortLabel, type TimezoneId, type TimezoneMode } from "@/lib/timezone";
import { Metric, Round, Standing } from "@/lib/types";

export function TrackMap({ round }: { round: Round }) {
  const startPoint = round.circuit.startPoint ?? { x: 20, y: 75 };
  const gradientId = `track-${round.round}`;
  const trackTransform = round.circuit.pathTransform;
  const sectorDash = round.circuit.id === "sepang" ? "14 86" : "16 84";
  const sectorPath = round.circuit.sectorPath ?? round.circuit.path;
  const hasExplicitSectorPath = Boolean(round.circuit.sectorPath);
  const sectorOffset = "0";

  return <div className="track-panel">
    <span className="track-index">CIRCUIT / {String(round.round).padStart(2, "0")}</span>
    <svg viewBox="0 0 190 140" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`แผนผังสนาม ${round.circuit.name}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f9f8f3" />
          <stop offset=".52" stopColor="#d9dde1" />
          <stop offset="1" stopColor="#8c949d" />
        </linearGradient>
        <filter id={`glow-${round.round}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={trackTransform}>
        <path className="track-bed" d={round.circuit.path} />
        <path className="track-edge" d={round.circuit.path} />
        <path className="track-line" d={round.circuit.path} stroke={`url(#${gradientId})`} />
        <path className="track-sector" d={sectorPath} pathLength={hasExplicitSectorPath ? undefined : 100} style={{ strokeDasharray: hasExplicitSectorPath ? "none" : sectorDash, strokeDashoffset: sectorOffset }} />
      </g>
      <g className="track-start" transform={"translate(" + startPoint.x + " " + startPoint.y + ")"}>
        <circle className="track-start-ring" r="6" />
        <circle className="track-start-core" r="2.6" />
      </g>
    </svg>
    <div className="track-legend" aria-hidden="true">
      <span><i className="legend-line" />TRACK</span>
      <span><i className="legend-sector" />SECTOR</span>
    </div>
    <div className="track-label">
      <b><CountryFlag country={round.circuit.country} />{round.circuit.name}</b>
      <span>{round.circuit.lengthKm} KM · {round.circuit.corners} CORNERS</span>
    </div>
  </div>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status.replaceAll("_", " ")}</span>;
}

export function MetricGrid({ items }: { items: Metric[] }) {
  return <div className="metric-grid">{items.map((m, index) => <article className="metric-card" key={m.id} style={{ "--tone": `var(--${m.tone ?? "cyan"})` } as React.CSSProperties}><div className="metric-topline"><span>0{index + 1}</span><div className="metric-label">{m.label}</div></div><div className="metric-value">{m.value}</div><div className="metric-note">{m.note}</div></article>)}</div>;
}

export function DriverCard({ driver }: { driver: Standing }) {
  const color = getTeamColor(driver.team, driver.color);
  return <article className="driver-card" id={`driver-${driver.code.toLowerCase()}`} style={{ "--team-color": color } as React.CSSProperties}><div className="driver-card-top"><span className="driver-rank">P{String(driver.position).padStart(2, "0")}</span><span className="driver-code">{driver.code}</span></div><div className="driver-card-body"><div className="team-mark" aria-hidden="true">{getTeamMark(driver.team)}</div><div className="driver-identity"><h3>{driver.name}</h3><p><span className="team-color-swatch" aria-hidden="true" />{driver.team}</p></div></div><div className="driver-stats"><span><small>POINTS</small><b>{driver.points ?? "—"}</b></span><span><small>WINS</small><b>{driver.wins ?? "—"}</b></span></div></article>;
}

export function DriverGrid({ drivers }: { drivers: Standing[] }) {
  return <div className="driver-grid">{drivers.map(driver => <DriverCard driver={driver} key={driver.code} />)}</div>;
}

export function RoundCard({ item, timezone = "Asia/Bangkok", timezoneMode = "my", locale = "en" }: { item: Round; timezone?: TimezoneId; timezoneMode?: TimezoneMode; locale?: Locale }) {
  const race = item.sessions.find(session => session.code === "R") ?? item.sessions.at(-1);
  const effectiveTimezone = displayTimezone(timezoneMode, timezone, item.circuit.country, item.circuit.locality);
  const timeLabel = timezoneMode === "track" ? message(locale, "trackTime").toUpperCase() : `${message(locale, "myTime").toUpperCase()} · ${timezoneShortLabel(effectiveTimezone)}`;
  return <Link href={`/rounds/${item.round}`} className="round-card"><span className="round-no">ROUND {String(item.round).padStart(2, "0")}</span><h3>{item.name}</h3><p className="round-card-location"><CountryFlag country={item.circuit.country} /><span>{item.circuit.locality}, {item.circuit.country}</span></p><div className="round-card-schedule"><small>RACE START · {timeLabel}</small><time dateTime={race?.startsAt ?? item.raceStartsAt}>{new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { year: "numeric", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: effectiveTimezone }).format(new Date(race?.startsAt ?? item.raceStartsAt))}</time></div><div className="session-strip"><span className="session-chip">{item.sessions.length} SESSIONS</span><StatusBadge status={item.sessions.at(-1)?.status ?? "scheduled"} /></div></Link>;
}

export function AdSlot() {
  return <div className="ad-slot" aria-label="พื้นที่โฆษณาที่สงวนขนาดไว้">ADVERTISEMENT · RESERVED SPACE</div>;
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className="page-head"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{children}</p></div>;
}
