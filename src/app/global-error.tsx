"use client";

import { ErrorRecovery, useRecoveryLocale } from "@/components/error-recovery";
import "@fontsource/noto-sans-thai/400.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useRecoveryLocale();
  return <html lang={locale}><body style={{ margin: 0, background: "#08090a", color: "#f5f7fa", fontFamily: "Noto Sans Thai, system-ui, sans-serif", padding: "clamp(20px, 6vw, 64px)", lineHeight: 1.6 }}>
    <style>{`.error-recovery{max-width:680px;margin:auto}.analysis-state-actions{display:flex;flex-wrap:wrap;gap:16px;margin-top:24px}.button{padding:12px 20px;color:#08090a;background:#f5f7fa;border:1px solid #f5f7fa;border-radius:6px;font:inherit;text-decoration:none;cursor:pointer}.button:focus-visible{outline:3px solid #39c6f4;outline-offset:4px}`}</style>
    <ErrorRecovery reset={reset} />
  </body></html>;
}
