import { Suspense } from "react";
import Link from "next/link";
import { DataHub } from "@/components/data-hub";
import { RouteLoading } from "@/components/route-loading";
import { getDataHub } from "@/lib/data-api";
import { getLocale } from "@/lib/i18n-server";
import { message, type Locale } from "@/lib/i18n";
import { currentScheduleRound, getScheduleRounds } from "@/lib/schedule";
import { displayTimezone } from "@/lib/timezone";
import { getTimezone, getTimezoneMode } from "@/lib/timezone-server";
import type { TimezoneId, TimezoneMode } from "@/lib/timezone";

export const dynamic = "force-dynamic";

async function DataHubContent({ locale, timezone, timezoneMode }: { locale: Locale; timezone: TimezoneId; timezoneMode: TimezoneMode }) {
  const snapshot = await getDataHub(timezone, locale);
  return <DataHub snapshot={snapshot} locale={locale} timezone={timezone} timezoneMode={timezoneMode} />;
}

export default async function Data() {
  const [locale, timezone, timezoneMode, schedule] = await Promise.all([getLocale(), getTimezone(), getTimezoneMode(), getScheduleRounds()]);
  const currentRound = timezoneMode === "track" && schedule.length > 0 ? currentScheduleRound(schedule) : undefined;
  const effectiveTimezone = displayTimezone(timezoneMode, timezone, currentRound?.circuit.country, currentRound?.circuit.locality);
  return <><Suspense fallback={<RouteLoading variant="dashboard" label="Loading data hub…" />}><DataHubContent locale={locale} timezone={effectiveTimezone} timezoneMode={timezoneMode} /></Suspense><section className="data-downloads"><div className="section-heading"><div><div className="eyebrow">EXPORTS</div><h2>{message(locale, "dataDownloads")}</h2></div><p><span>VALIDATED AGGREGATES</span><br />CSV · PARQUET</p></div><div className="round-grid"><article className="round-card"><span className="round-no">CSV</span><h3>Calendar</h3><p>{message(locale, "dataSchedule")}</p><Link className="link-arrow" href="/api/export/calendar">Download CSV →</Link></article><article className="round-card"><span className="round-no">CSV</span><h3>Standings</h3><p>{message(locale, "dataStandings")}</p><Link className="link-arrow" href="/api/export/standings">Download CSV →</Link></article><article className="round-card"><span className="round-no">PARQUET</span><h3>Telemetry artifacts</h3><p>{message(locale, "dataTelemetry")}</p><span className="badge scheduled">{message(locale, "dataWorkerPending")}</span></article></div></section></>;
}
