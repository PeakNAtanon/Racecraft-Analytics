import { notFound } from "next/navigation";
import { CompletenessDashboard } from "@/components/completeness-dashboard";
import { diagnosticsEnabled, getCompletenessSnapshot } from "@/lib/diagnostics";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  if (!diagnosticsEnabled()) notFound();
  const snapshot = await getCompletenessSnapshot();
  return <CompletenessDashboard snapshot={snapshot} />;
}
