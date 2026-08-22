import { getNews } from "@/lib/data";
import { PageHead } from "@/components/shared";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";
import { currentScheduleRound, getScheduleRounds } from "@/lib/schedule";
import { displayTimezone, timezoneShortLabel } from "@/lib/timezone";
import { getTimezone, getTimezoneMode } from "@/lib/timezone-server";

export const revalidate = 600;

export default async function Analysis({ searchParams }: { searchParams?: Promise<{ source?: string | string[] }> }) {
  const [news, locale, timezone, timezoneMode, schedule] = await Promise.all([getNews(), getLocale(), getTimezone(), getTimezoneMode(), getScheduleRounds()]);
  const params = searchParams ? await searchParams : {};
  const sourceParam = Array.isArray(params.source) ? params.source[0] : params.source;
  const filteredNews = sourceParam === "autosport" ? news.filter(item => item.provider === "Autosport") : sourceParam === "motorsport" ? news.filter(item => item.provider === "Motorsport.com") : news;
  const currentRound = timezoneMode === "track" && schedule.length > 0 ? currentScheduleRound(schedule) : undefined;
  const effectiveTimezone = displayTimezone(timezoneMode, timezone, currentRound?.circuit.country, currentRound?.circuit.locality);
  const timeLabel = timezoneMode === "track" ? message(locale, "trackTime").toUpperCase() : `${message(locale, "myTime").toUpperCase()} · ${timezoneShortLabel(effectiveTimezone)}`;
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const sourceLabel = sourceParam === "autosport" ? message(locale, "analysisAutosportPrimary") : sourceParam === "motorsport" ? message(locale, "analysisMotorsportSupplement") : message(locale, "analysisAllSources");
  return <>
    <PageHead eyebrow="NEWS WIRE · RSS" title="News">{message(locale, "analysisDescription")}</PageHead>
    <div className="notice">{message(locale, "analysisNotice")}<br />{message(locale, "analysisDedupNotice")}</div>
    <section className="section">
      <div className="news-status-bar panel" aria-label="RSS news snapshot">
        <div><div className="eyebrow">RSS SNAPSHOT</div><strong>{filteredNews.length} STORIES</strong><p>{sourceLabel} · {timeLabel}</p></div>
        <span className="news-status-meta">{news.length} TOTAL · DEDUPLICATED</span>
      </div>
      <div className="news-filter" aria-label={message(locale, "analysisSourceFilter")}>
        <span className="eyebrow">{message(locale, "analysisSourceFilter")}</span>
        <a className={!sourceParam ? "active" : ""} href="/analysis" aria-current={!sourceParam ? "page" : undefined}>{message(locale, "analysisAllSources")}</a>
        <a className={sourceParam === "autosport" ? "active" : ""} href="/analysis?source=autosport" aria-current={sourceParam === "autosport" ? "page" : undefined}>{message(locale, "analysisAutosportPrimary")}</a>
        <a className={sourceParam === "motorsport" ? "active" : ""} href="/analysis?source=motorsport" aria-current={sourceParam === "motorsport" ? "page" : undefined}>{message(locale, "analysisMotorsportSupplement")}</a>
      </div>
      {filteredNews.length ? <div className="news-grid">{filteredNews.map(item => <a className="news-card" href={item.url} target="_blank" rel="noopener noreferrer" key={item.id}>
        <div className={`news-card-media${item.imageUrl ? " has-image" : ""}`} style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined} role="img" aria-label={`${item.title} preview`}><div className="news-card-fallback" aria-hidden="true"><span>RACECRAFT</span><strong>NEWS WIRE</strong><i /></div></div>
        <div className="news-card-body"><span className="news-source">{item.provider} · {item.source} · {timeLabel} · {new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short", timeZone: effectiveTimezone }).format(new Date(item.publishedAt))}</span><h3>{item.title}</h3><p>{item.description}</p><span className="link-arrow">{message(locale, "analysisRead")}</span></div>
      </a>)}</div> : <div className="empty">{message(locale, "analysisEmpty")}</div>}
    </section>
  </>;
}
