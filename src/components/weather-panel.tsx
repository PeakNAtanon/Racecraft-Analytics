import type { Locale } from "@/lib/i18n";
import type { TimezoneId } from "@/lib/timezone";
import type { WeatherSnapshot } from "@/lib/types";

interface WeatherPanelProps {
  weather?: WeatherSnapshot;
  trackName: string;
  timezone: TimezoneId;
  locale: Locale;
}

function value(value: number | undefined, suffix = "") {
  return value === undefined ? "—" : value.toFixed(1) + suffix;
}

function sampleTime(value: string | undefined, locale: Locale, timezone: TimezoneId) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(date);
}

export function WeatherPanel({ weather, trackName, timezone, locale }: WeatherPanelProps) {
  const hasSample = Boolean(weather && (weather.sampledAt || weather.airTemperature !== undefined || weather.trackTemperature !== undefined || weather.humidity !== undefined));
  const rainfall = weather?.rainfall === undefined ? "—" : weather.rainfall ? "RAIN DETECTED" : "DRY";
  const wind = weather?.windSpeed === undefined ? "—" : value(weather.windSpeed, " m/s") + (weather.windDirection === undefined ? "" : " · " + Math.round(weather.windDirection) + "°");

  return (
    <section className="section panel weather-panel" aria-labelledby="track-weather-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">TRACK WEATHER · OPENF1</div>
          <h2 id="track-weather-title">Circuit conditions</h2>
        </div>
        <p>
          <span>{hasSample ? "LATEST SESSION SAMPLE" : "AWAITING SESSION DATA"}</span>
          <br />{hasSample ? weather?.sessionName : trackName}
        </p>
      </div>
      {hasSample ? (
        <>
          <dl className="weather-grid">
            <div className="weather-stat"><dt>AIR TEMPERATURE</dt><dd>{value(weather?.airTemperature, "°C")}</dd><small>ambient air</small></div>
            <div className="weather-stat"><dt>TRACK TEMPERATURE</dt><dd>{value(weather?.trackTemperature, "°C")}</dd><small>surface sample</small></div>
            <div className="weather-stat"><dt>HUMIDITY</dt><dd>{value(weather?.humidity, "%")}</dd><small>relative humidity</small></div>
            <div className="weather-stat"><dt>RAINFALL</dt><dd className={weather?.rainfall ? "weather-rain" : "weather-dry"}>{rainfall}</dd><small>provider flag</small></div>
            <div className="weather-stat"><dt>WIND</dt><dd>{wind}</dd><small>speed · direction</small></div>
            <div className="weather-stat"><dt>SAMPLED</dt><dd className="weather-sampled">{sampleTime(weather?.sampledAt, locale, timezone)}</dd><small>local display time</small></div>
          </dl>
          <p className="weather-note">OpenF1 weather sample · values describe the latest completed session available in the provider feed.</p>
        </>
      ) : (
        <div className="weather-empty">
          <strong>Weather data is not available yet</strong>
          <p>OpenF1 publishes circuit conditions after a session starts. The panel will update when the provider returns a sample.</p>
          <span>STATUS · PROVISIONAL</span>
        </div>
      )}
    </section>
  );
}