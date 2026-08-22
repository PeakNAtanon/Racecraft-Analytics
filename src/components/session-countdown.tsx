"use client";

import { useEffect, useState } from "react";
import { SessionInfo } from "@/lib/types";
import { message, type Locale } from "@/lib/i18n";
import { timezoneShortLabel, type TimezoneId } from "@/lib/timezone";

function localTime(value: string, locale: Locale, timezone: TimezoneId) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { year: "numeric", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value));
}

function remaining(value: number) {
  const total = Math.max(0, value);
  const seconds = Math.floor(total / 1000);
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 };
}

export function SessionCountdown({ session, locale = "en", timezone = "Asia/Bangkok" }: { session: SessionInfo; locale?: Locale; timezone?: TimezoneId }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const start = Date.parse(session.startsAt);
  const end = session.endsAt ? Date.parse(session.endsAt) : Number.NaN;
  const isLive = now !== null && now >= start && (!Number.isFinite(end) || now <= end);
  const isComplete = now !== null && Number.isFinite(end) ? now > end : now !== null && now > start && session.status === "complete";
  const clock = now === null ? message(locale, "syncing") : isLive ? message(locale, "onAir") : isComplete ? message(locale, "complete") : (() => { const value = remaining(start - now); return `${value.days}d ${String(value.hours).padStart(2, "0")}h ${String(value.minutes).padStart(2, "0")}m ${String(value.seconds).padStart(2, "0")}s`; })();
  const state = isLive ? "live" : isComplete ? "complete" : "scheduled";

  return <div className={`session-countdown ${state}`} data-state={state} aria-live="polite">
    <span>{isLive ? message(locale, "sessionLive") : isComplete ? message(locale, "sessionEnded") : message(locale, "startsIn")}</span>
    <strong>{clock}</strong>
    <time dateTime={session.startsAt}>{localTime(session.startsAt, locale, timezone)} · {timezoneShortLabel(timezone)}</time>
  </div>;
}
