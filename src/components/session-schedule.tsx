import { Round } from "@/lib/types";
import { StatusBadge } from "./shared";
import { SessionCountdown } from "./session-countdown";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";
import { getTimezone, getTimezoneMode } from "@/lib/timezone-server";
import { displayTimezone, timezoneShortLabel } from "@/lib/timezone";

export async function SessionSchedule({ round }: { round: Round }) {
  const [locale, timezone, timezoneMode] = await Promise.all([getLocale(), getTimezone(), getTimezoneMode()]);
  const effectiveTimezone = displayTimezone(timezoneMode, timezone, round.circuit.country, round.circuit.locality);
  const timeLabel = timezoneMode === "track" ? message(locale, "trackTime").toUpperCase() : `${message(locale, "myTime").toUpperCase()} · ${timezoneShortLabel(effectiveTimezone)}`;
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  return <section className="section session-schedule" aria-labelledby="session-schedule-title">
    <div className="section-heading"><div><div className="eyebrow">{timeLabel}</div><h2 id="session-schedule-title">Weekend timeline</h2></div><p><span>COUNTDOWN</span><br/>{message(locale,"sessionCountdown")}</p></div>
    <div className="session-schedule-panel">
      <div className="session-schedule-head"><span>SESSION</span><span>{timeLabel}</span><span>COUNTDOWN</span></div>
      <div className="session-schedule-list">{round.sessions.map(session => <article className="session-schedule-row" key={`${round.round}-${session.code}`}>
        <div className="session-schedule-code"><b>{session.code}</b><span>{session.name}</span></div>
        <div className="session-schedule-time"><time dateTime={session.startsAt}>{new Intl.DateTimeFormat(dateLocale, { weekday: "short", year: "numeric", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: effectiveTimezone }).format(new Date(session.startsAt))}</time><small>{session.endsAt ? `ends ${new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit", timeZone: effectiveTimezone }).format(new Date(session.endsAt))} ${timezoneShortLabel(effectiveTimezone)}` : "provider start time"}</small></div>
        <SessionCountdown session={session} locale={locale} timezone={effectiveTimezone}/>
        <StatusBadge status={session.status}/>
      </article>)}</div>
    </div>
    <p className="session-schedule-note">{message(locale,"sessionDataNote")}</p>
  </section>;
}
