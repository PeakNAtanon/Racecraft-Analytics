import { PageHead, RoundCard } from "@/components/shared";import { getScheduleRounds } from "@/lib/schedule";import { getLocale } from "@/lib/i18n-server";import { message } from "@/lib/i18n";import { getTimezone, getTimezoneMode } from "@/lib/timezone-server";
export const metadata={title:"Calendar"};
export const revalidate = 600;
export default async function Calendar(){const [rounds,locale,timezone,timezoneMode]=await Promise.all([getScheduleRounds(),getLocale(),getTimezone(),getTimezoneMode()]);return <><PageHead eyebrow="2026 SEASON · API SCHEDULE" title="Race Calendar">{message(locale,"calendarDescription")}</PageHead><div className="round-grid">{rounds.map(r=><RoundCard key={r.round} item={r} timezone={timezone} timezoneMode={timezoneMode} locale={locale}/>)}</div></>}
