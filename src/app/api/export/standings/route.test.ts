import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/data-api", () => ({ getSeasonStandings: vi.fn() }));
import { getSeasonStandings } from "@/lib/data-api";
import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

it("does not export fallback scores as a successful standings download", async () => {
  vi.mocked(getSeasonStandings).mockResolvedValue({ season: 2026, round: 0, source: "fallback", complete: false, standings: [], profiles: [] });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("exports provider standings even when the published grid is partial", async () => {
  vi.mocked(getSeasonStandings).mockResolvedValue({ season: 2026, round: 3, source: "Jolpica", complete: false, standings: [{ position: 1, code: "VER", name: "Max Verstappen", team: "Red Bull", wins: 1, points: 25 }], profiles: [] });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('"2026","3","1","VER"');
});
