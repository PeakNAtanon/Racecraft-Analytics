import { NextResponse } from "next/server";
import { getCircuitHistorySummaryBySlug } from "@/lib/data-api";

export const revalidate = 600;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("circuit") ?? params.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing circuit" }, { status: 400 });
  const history = await getCircuitHistorySummaryBySlug(slug);
  return NextResponse.json({ ...history, circuit: slug });
}
