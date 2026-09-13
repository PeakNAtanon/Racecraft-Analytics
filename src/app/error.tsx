"use client";

import { ErrorRecovery } from "@/components/error-recovery";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorRecovery reset={reset} />;
}
