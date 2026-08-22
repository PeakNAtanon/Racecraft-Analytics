import Link from "next/link";
import { CountryFlag } from "@/components/country-flag";
import { timezoneShortLabel, type TimezoneId, type TimezoneMode } from "@/lib/timezone";
import type { Round } from "@/lib/types";

interface TrackDataProps {
  round: Round;
  timezone: TimezoneId;
  timezoneMode: TimezoneMode;
}

function formatLength(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) + " KM" : "—";
}

function formatCount(value: number) {
  return Number.isFinite(value) ? String(value) : "—";
}

export function TrackData({ round, timezone, timezoneMode }: TrackDataProps) {
  const timeLabel = timezoneMode === "track" ? "TRACK TIME" : "MY TIME · " + timezoneShortLabel(timezone);

  return (
    <section className="section track-data-section" aria-labelledby="track-data-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">TRACK DATA · API SCHEDULE</div>
          <h2 id="track-data-title">Track intelligence</h2>
        </div>
        <p>
          <span>{round.season} / ROUND {String(round.round).padStart(2, "0")}</span>
          <br />Normalized schedule record
        </p>
      </div>

      <div className="track-data-layout">
        <div className="track-data-lead">
          <div className="track-data-index">CIRCUIT / {String(round.round).padStart(2, "0")}</div>
          <div className="track-data-identity">
            <CountryFlag country={round.circuit.country} />
            <div>
              <h3>{round.circuit.name}</h3>
              <p>{round.circuit.locality}, {round.circuit.country}</p>
            </div>
          </div>
          <Link href={"/circuits/" + round.slug} className="link-arrow">
            VIEW CIRCUIT PROFILE <span aria-hidden="true">→</span>
          </Link>
        </div>

        <dl className="track-data-stats">
          <div>
            <dt>TRACK LENGTH</dt>
            <dd>{formatLength(round.circuit.lengthKm)}</dd>
          </div>
          <div>
            <dt>CORNERS</dt>
            <dd>{formatCount(round.circuit.corners)}</dd>
          </div>
          <div>
            <dt>WEEKEND SESSIONS</dt>
            <dd>{formatCount(round.sessions.length)}</dd>
          </div>
          <div>
            <dt>DISPLAY TIME</dt>
            <dd>{timeLabel}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}