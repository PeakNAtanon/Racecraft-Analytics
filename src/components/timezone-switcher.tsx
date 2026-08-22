"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { message, type Locale } from "@/lib/i18n";
import { isTimezone, timezoneCookie, timezoneModeCookie, type TimezoneId, type TimezoneMode } from "@/lib/timezone";

export function TimezoneSwitcher({ locale, timezone, mode }: { locale: Locale; timezone: TimezoneId; mode: TimezoneMode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const deviceTimezone = typeof Intl === "undefined" ? "" : Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (mode !== "my" || !isTimezone(deviceTimezone) || timezone === deviceTimezone) return;
    document.cookie = `${timezoneCookie}=${encodeURIComponent(deviceTimezone)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  }, [deviceTimezone, mode, router, timezone]);

  function changeTimezone(value: string) {
    const [kind] = value.split("|");
    const nextMode = kind === "track" ? "track" : "my";
    document.cookie = `${timezoneModeCookie}=${nextMode}; Path=/; Max-Age=31536000; SameSite=Lax`;
    if (nextMode === "my" && isTimezone(deviceTimezone)) document.cookie = `${timezoneCookie}=${encodeURIComponent(deviceTimezone)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  const value = mode === "track" ? "track|" : "my|";
  return <label className="timezone-switcher">
    <span className="sr-only">{message(locale, "timeZone")}</span>
    <select aria-label={message(locale, "timeZone")} value={value} disabled={isPending} onChange={event => changeTimezone(event.target.value)}>
      <option value="my|">MY · {message(locale, "myTime")}</option>
      <option value="track|">TRACK · {message(locale, "trackTime")}</option>
    </select>
  </label>;
}
