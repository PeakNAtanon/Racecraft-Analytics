"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Root-layout recovery needs a full document navigation. */

import { useSyncExternalStore } from "react";
import { analysisText as text } from "@/lib/analysis-copy";
import { localeCookie, type Locale } from "@/lib/i18n";

const subscribe = () => () => {};
export function useRecoveryLocale(): Locale {
  return useSyncExternalStore(subscribe, () => document.cookie.split(";").some(cookie => cookie.trim() === `${localeCookie}=th`) ? "th" : "en", () => "en");
}

export function ErrorRecovery({ reset }: { reset: () => void }) {
  const locale = useRecoveryLocale();
  return <section className="error-recovery" role="alert" lang={locale}>
    <h1>{text(locale, "Could not load this page")}</h1>
    <p>{text(locale, "The page could not finish loading. Retry keeps your current URL and filters.")}</p>
    <div className="analysis-state-actions"><button type="button" className="button" onClick={reset}>{text(locale, "Try again")}</button><a className="button button-secondary" href="/">{text(locale, "Back to home")}</a></div>
  </section>;
}
