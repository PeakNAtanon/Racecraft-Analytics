import { cookies } from "next/headers";
import { defaultTimezone, isTimezone, isTimezoneMode, timezoneCookie, timezoneModeCookie, type TimezoneId, type TimezoneMode } from "./timezone";

export async function getTimezone(): Promise<TimezoneId> {
  const store = await cookies();
  const value = store.get(timezoneCookie)?.value;
  return isTimezone(value) ? value : defaultTimezone;
}

export async function getTimezoneMode(): Promise<TimezoneMode> {
  const store = await cookies();
  const value = store.get(timezoneModeCookie)?.value;
  return isTimezoneMode(value) ? value : "my";
}
