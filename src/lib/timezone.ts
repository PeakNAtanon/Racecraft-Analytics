export const timezoneCookie = "racecraft-timezone";
export const timezoneModeCookie = "racecraft-timezone-mode";
export const defaultTimezone = "Asia/Bangkok";

export type TimezoneMode = "my" | "track";

export const timezoneOptions = [
  { id: "Asia/Bangkok", code: "ICT", en: "Thailand · Bangkok", th: "ไทย · กรุงเทพฯ" },
  { id: "Asia/Tokyo", code: "JST", en: "Japan · Tokyo", th: "ญี่ปุ่น · โตเกียว" },
  { id: "Asia/Singapore", code: "SGT", en: "Singapore", th: "สิงคโปร์" },
  { id: "Asia/Kolkata", code: "IST", en: "India · Kolkata", th: "อินเดีย · โกลกาตา" },
  { id: "Europe/London", code: "UK", en: "United Kingdom · London", th: "สหราชอาณาจักร · ลอนดอน" },
  { id: "Europe/Paris", code: "CET", en: "Europe · Paris", th: "ยุโรป · ปารีส" },
  { id: "America/New_York", code: "ET", en: "United States · New York", th: "สหรัฐฯ · นิวยอร์ก" },
  { id: "America/Los_Angeles", code: "PT", en: "United States · Los Angeles", th: "สหรัฐฯ · ลอสแอนเจลิส" },
  { id: "America/Sao_Paulo", code: "BRT", en: "Brazil · São Paulo", th: "บราซิล · เซาเปาลู" },
  { id: "Australia/Melbourne", code: "AET", en: "Australia · Melbourne", th: "ออสเตรเลีย · เมลเบิร์น" },
  { id: "UTC", code: "UTC", en: "UTC", th: "UTC" },
] as const;

export type TimezoneId = string;

export function isTimezoneMode(value: string | undefined): value is TimezoneMode {
  return value === "my" || value === "track";
}

export function isTimezone(value: string | undefined): value is TimezoneId {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function timezoneOption(id: TimezoneId) {
  return timezoneOptions.find(option => option.id === id) ?? { id, code: timezoneShortLabel(id), en: id, th: id };
}

export function timezoneShortLabel(id: TimezoneId) {
  return timezoneOptions.find(option => option.id === id)?.code ?? (id === "UTC" ? "UTC" : id.split("/").at(-1)?.replaceAll("_", " ").slice(0, 10).toUpperCase() ?? "LOCAL");
}

const countryTimezones: Record<string, string> = {
  australia: "Australia/Melbourne",
  austria: "Europe/Vienna",
  azerbaijan: "Asia/Baku",
  bahrain: "Asia/Bahrain",
  belgium: "Europe/Brussels",
  brazil: "America/Sao_Paulo",
  canada: "America/Toronto",
  china: "Asia/Shanghai",
  hungary: "Europe/Budapest",
  italy: "Europe/Rome",
  japan: "Asia/Tokyo",
  mexico: "America/Mexico_City",
  monaco: "Europe/Monaco",
  netherlands: "Europe/Amsterdam",
  portugal: "Europe/Lisbon",
  qatar: "Asia/Qatar",
  saudiarabia: "Asia/Riyadh",
  singapore: "Asia/Singapore",
  spain: "Europe/Madrid",
  uae: "Asia/Dubai",
  usa: "America/New_York",
  uk: "Europe/London",
  unitedstates: "America/New_York",
  unitedkingdom: "Europe/London",
};

const localityTimezones: Record<string, string> = {
  austin: "America/Chicago",
  lasvegas: "America/Los_Angeles",
  miami: "America/New_York",
  montreal: "America/Toronto",
};

export function circuitTimezone(country = "", locality = "") {
  const localityKey = locality.toLowerCase().replace(/[^a-z]/g, "");
  const countryKey = country.toLowerCase().replace(/[^a-z]/g, "");
  return localityTimezones[localityKey] ?? countryTimezones[countryKey] ?? defaultTimezone;
}

export function displayTimezone(mode: TimezoneMode, myTimezone: TimezoneId, country?: string, locality?: string) {
  return mode === "track" ? circuitTimezone(country, locality) : myTimezone;
}
