import { diagnosticsEnabled, getCompletenessSnapshot } from "@/lib/diagnostics";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!diagnosticsEnabled()) {
    return Response.json({ error: "Developer diagnostics are disabled." }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  try {
    const snapshot = await getCompletenessSnapshot();
    return Response.json(snapshot, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Diagnostics snapshot could not be collected." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
