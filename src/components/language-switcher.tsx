"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { localeCookie, type Locale, message } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeLocale(nextLocale: Locale) {
    document.cookie = `${localeCookie}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = nextLocale;
    startTransition(() => router.refresh());
  }

  return <label className="language-switcher">
    <span className="sr-only">{message(locale, "language")}</span>
    <select aria-label={message(locale, "language")} value={locale} disabled={isPending} onChange={event => changeLocale(event.target.value as Locale)}>
      <option value="en">EN · {message(locale, "english")}</option>
      <option value="th">TH · {message(locale, "thai")}</option>
    </select>
  </label>;
}
