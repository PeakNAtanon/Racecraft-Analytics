import type { Metadata } from "next";
import Link from "next/link";
import { Header, MobileNav } from "@/components/navigation";
import { GlobalDiagnosticsShortcut } from "@/components/diagnostics-shortcut";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";
import { getTimezone, getTimezoneMode } from "@/lib/timezone-server";
import "flag-icons/css/flag-icons.min.css";
import "./tailwind.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteTitle = "Racecraft Analytics";
const siteDescription = "Deep F1 race analysis powered by data from Jolpica, OpenF1, FastF1 and RSS sources.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: "%s · Racecraft Analytics" },
  description: siteDescription,
  applicationName: siteTitle,
  openGraph: {
    type: "website",
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    url: "/",
    locale: "en_US",
    images: [{ url: "/og-image.svg", type: "image/svg+xml", width: 1200, height: 630, alt: "Racecraft Analytics — F1 Data Editorial" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.svg"],
  },
};
export default async function RootLayout({children}:{children:React.ReactNode}){const [locale,timezone,timezoneMode]=await Promise.all([getLocale(),getTimezone(),getTimezoneMode()]);return <html lang={locale} data-scroll-behavior="smooth"><body className="antialiased text-race-text"><GlobalDiagnosticsShortcut/><a className="skip-link" href="#main-content">Skip to content</a><Header initialLocale={locale} initialTimezone={timezone} initialTimezoneMode={timezoneMode}/><main id="main-content" tabIndex={-1} className="shell main">{children}</main><footer className="footer"><div className="shell footer-inner"><div>© 2026 Racecraft Analytics · Independent data analysis</div><div className="footer-links"><Link href="/methodology">{message(locale,"methodology")}</Link><Link href="/sources">{message(locale,"sources")}</Link><Link href="/about">{message(locale,"about")}</Link><Link href="/privacy">{message(locale,"privacy")}</Link><Link href="/terms">{message(locale,"terms")}</Link><Link href="/cookies">{message(locale,"cookies")}</Link></div></div></footer><MobileNav initialLocale={locale}/></body></html>}
