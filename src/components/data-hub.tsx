import { DataCategory, DataHubSnapshot } from "@/lib/data-api";
import { message, type Locale } from "@/lib/i18n";
import { timezoneShortLabel, type TimezoneId, type TimezoneMode } from "@/lib/timezone";
import { openF1PublicationLabel } from "@/lib/openf1-availability";

function formatSnapshot(value: string, locale: Locale, timezone: TimezoneId) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}

function SourceBadge({ category }: { category: DataCategory }) {
  return <span className={`data-source-badge ${category.status}`}><i aria-hidden="true" />{category.statusLabel}</span>;
}

function PreviewTable({ category }: { category: DataCategory }) {
  if (!category.rows.length) return <div className="data-empty">ยังไม่มี record สำหรับหมวดนี้ · รอ provider หรือ FastF1 worker artifact</div>;
  return <div className="data-table-scroll"><table className="data-table data-hub-table"><thead><tr>{category.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{category.rows.map((row, rowIndex) => <tr key={`${category.id}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${category.id}-${rowIndex}-${cellIndex}`}>{category.columns[cellIndex] === "LINK" ? <a className="data-cell-link" href={cell} target="_blank" rel="noopener noreferrer">เปิดต้นฉบับ ↗</a> : cell}</td>)}</tr>)}</tbody></table></div>;
}

export function DataHub({ snapshot, locale, timezone, timezoneMode = "my" }: { snapshot: DataHubSnapshot; locale: Locale; timezone: TimezoneId; timezoneMode?: TimezoneMode }) {
  const liveCount = snapshot.categories.filter(category => category.status === "live").length;
  const recordsCount = snapshot.categories.reduce((total, category) => total + category.count, 0);
  const timeLabel = timezoneMode === "track" ? message(locale, "trackTime").toUpperCase() : `${message(locale, "myTime").toUpperCase()} · ${timezoneShortLabel(timezone)}`;
  return <>
    <section className="data-hub-hero">
      <div><div className="eyebrow">API DATA HUB · {snapshot.season}</div><h1>Every signal.<br /><em>Separated.</em></h1><p>{message(locale,"dataDescription")}</p></div>
      <div className="data-hub-readout"><span><small>SNAPSHOT · {timeLabel}</small>{formatSnapshot(snapshot.generatedAt, locale, timezone)}</span><span><small>API CHANNELS</small>{liveCount} LIVE / {snapshot.categories.length} CATEGORIES</span><span><small>OPENF1 WINDOW</small>{openF1PublicationLabel(snapshot.openF1PublicationState)}</span><span><small>VISIBLE RECORDS</small>{recordsCount.toLocaleString("en-US")}</span></div>
    </section>
    <nav className="data-hub-index" aria-label="หมวดหมู่ข้อมูล API">{snapshot.categories.map((category, index) => <a href={`#${category.id}`} key={category.id}><span>{String(index + 1).padStart(2, "0")}</span>{category.label}<SourceBadge category={category} /></a>)}</nav>
    <div className="data-category-list">{snapshot.categories.map((category, index) => <section className="data-category" id={category.id} key={category.id}>
      <div className="data-category-header"><div className="data-category-title"><span className="data-category-index">{String(index + 1).padStart(2, "0")}</span><div><div className="eyebrow">{category.provider}</div><h2>{category.label}</h2><p>{category.description}</p></div></div><div className="data-category-meta"><SourceBadge category={category} /><span>{category.count.toLocaleString("en-US")} records</span><a href={category.endpoint} target="_blank" rel="noopener noreferrer">API endpoint ↗</a></div></div>
      <PreviewTable category={category} />
    </section>)}</div>
    <div className="data-hub-note">Provider ล่มจะไม่ลบข้อมูลที่เผยแพร่แล้ว · หน้านี้แสดง snapshot ฝั่ง server และไม่เรียก API จาก browser โดยตรง · ตรวจสอบสิทธิ์ commercial use ของแต่ละ provider ก่อนเปิดใช้งานเชิงพาณิชย์</div>
  </>;
}
