"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, CircuitBoard, GitCompareArrows, Menu, UsersRound } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TimezoneSwitcher } from "@/components/timezone-switcher";
import { message, type Locale, type MessageKey } from "@/lib/i18n";
import type { TimezoneId, TimezoneMode } from "@/lib/timezone";

const desktop: Array<[MessageKey, string]> = [["currentRound", "/"], ["calendar", "/calendar"], ["circuits", "/circuits"], ["news", "/analysis"], ["compare", "/compare"], ["standings", "/standings"], ["analysis", "/drivers"], ["data", "/data"]];

function isActivePath(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/calendar") return path === "/calendar" || path.startsWith("/rounds/");
  if (href === "/sources") return ["/sources", "/methodology", "/about", "/privacy", "/terms", "/cookies", "/circuits", "/standings", "/data"].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  return path === href || path.startsWith(`${href}/`);
}

export function Header({ initialLocale = "en", initialTimezone = "Asia/Bangkok", initialTimezoneMode = "my" }: { initialLocale?: Locale; initialTimezone?: TimezoneId; initialTimezoneMode?: TimezoneMode }) {
  const path = usePathname();
  return <header className="site-header"><div className="shell header-inner"><Link href="/" prefetch={false} className="brand" aria-label="Racecraft Analytics home"><span className="brand-mark" /><span>RACECRAFT<small>ANALYTICS</small></span></Link><nav className="desktop-nav" aria-label={message(initialLocale, "mainNavigation")}>{desktop.map(([key, href], index) => { const active = isActivePath(path, href); return <Link key={href} href={href} prefetch={false} className={`nav-link ${active ? "active" : ""} ${index > 4 ? "optional" : ""}`} aria-current={active ? "page" : undefined}>{message(initialLocale, key)}</Link>; })}</nav><div className="header-tools"><div className="status-live"><span className="dot" /><span>{message(initialLocale, "pipeline")}<br /><b>{message(initialLocale, "online")}</b></span></div><LanguageSwitcher locale={initialLocale} /><TimezoneSwitcher locale={initialLocale} timezone={initialTimezone} mode={initialTimezoneMode} /></div></div></header>;
}

export function MobileNav({ initialLocale = "en" }: { initialLocale?: Locale }) {
  const path = usePathname();
  return <nav className="mobile-nav" aria-label={message(initialLocale, "mobileNavigation")}><Link href="/" prefetch={false} className={isActivePath(path, "/") ? "active" : ""} aria-current={isActivePath(path, "/") ? "page" : undefined}><CircuitBoard size={18} />{message(initialLocale, "home")}</Link><Link href="/calendar" prefetch={false} className={isActivePath(path, "/calendar") ? "active" : ""} aria-current={isActivePath(path, "/calendar") ? "page" : undefined}><CalendarDays size={18} />{message(initialLocale, "rounds")}</Link><Link href="/drivers" prefetch={false} className={isActivePath(path, "/drivers") ? "active" : ""} aria-current={isActivePath(path, "/drivers") ? "page" : undefined}><UsersRound size={18} />{message(initialLocale, "analysis")}</Link><Link href="/analysis" prefetch={false} className={isActivePath(path, "/analysis") ? "active" : ""} aria-current={isActivePath(path, "/analysis") ? "page" : undefined}><BarChart3 size={18} />{message(initialLocale, "news")}</Link><Link href="/compare" prefetch={false} className={isActivePath(path, "/compare") ? "active" : ""} aria-current={isActivePath(path, "/compare") ? "page" : undefined}><GitCompareArrows size={18} />{message(initialLocale, "compare")}</Link><Link href="/sources" prefetch={false} className={isActivePath(path, "/sources") ? "active" : ""} aria-current={isActivePath(path, "/sources") ? "page" : undefined}><Menu size={18} />{message(initialLocale, "more")}</Link></nav>;
}
