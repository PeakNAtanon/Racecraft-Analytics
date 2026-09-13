"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { analysisText as text } from "@/lib/analysis-copy";
import type { Locale } from "@/lib/i18n";

export type AnalysisState = "scheduled" | "processing" | "partial" | "unavailable" | "ready";
export function AnalysisDataState({ state, locale, updatedAt, availableSessionHref }: { state: AnalysisState; locale: Locale; updatedAt?: string; availableSessionHref?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const title = { scheduled: "Not started", processing: "Waiting for analysis", partial: "Partial data", unavailable: "No matching data", ready: "Data ready" } as const;
  const explanation = { scheduled: "Analysis becomes available after the session ends and its data is published.", processing: "This session has no published analysis yet. Check again later or open an available session.", partial: "Some laps or channels are missing. Gaps are not measured values.", unavailable: "Try clearing the filters or choose another session." } as const;
  const validDate = updatedAt && Number.isFinite(Date.parse(updatedAt)) ? updatedAt : undefined;
  return <aside className={`analysis-data-state analysis-data-state-${state}`} aria-live="polite">
    <strong>{text(locale, title[state])}</strong>
    {state !== "ready" && <p>{text(locale, explanation[state])}</p>}
    <small>{validDate ? <>{text(locale, "Updated")} <time dateTime={validDate}>{new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(validDate))} UTC</time></> : text(locale, "Update time unavailable")}</small>
    {state !== "ready" && <div className="analysis-state-actions">
      <button className="button button-secondary" type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{text(locale, pending ? "Loading analysis for the selected filters…" : "Check again")}</button>
      <Link className="button button-secondary" href={availableSessionHref ?? "/calendar"}>{text(locale, availableSessionHref ? "Open an available session" : "View calendar")}</Link>
    </div>}
  </aside>;
}
