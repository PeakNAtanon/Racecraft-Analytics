import { afterEach, expect, it, vi } from "vitest";
import type { SessionAnalyticsSnapshot } from "./types";

const { readArtifact, schedule } = vi.hoisted(() => ({
  readArtifact: vi.fn(),
  schedule: vi.fn(),
}));
vi.mock("./fastf1-artifacts", () => ({ getFastF1SessionArtifact: readArtifact }));
vi.mock("./schedule", () => ({ getScheduleRounds: schedule }));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("uses the FastF1 artifact and one Jolpica result request instead of three OpenF1 requests", async () => {
  vi.stubEnv("JOLPICA_BASE_URL", "https://jolpica.test/ergast/f1");
  vi.stubEnv("OPENF1_BASE_URL", "https://openf1.test/v1");
  schedule.mockResolvedValue([{ round: 2, sessions: [{ sessionKey: 999, code: "R", name: "Race", startsAt: "2020-03-08", endsAt: "2020-03-09" }] }]);
  readArtifact.mockResolvedValue({
    source: "FastF1",
    sessionName: "Race",
    metrics: [],
    pace: { source: "FastF1", sessionLabel: "FastF1 Race", laps: [], series: [] },
    stints: [],
    results: [],
    resultsSource: "fallback",
    weather: { source: "FastF1", sessionName: "Race" },
  } satisfies SessionAnalyticsSnapshot);
  const fetchMock = vi.fn(async (url: string) => Response.json({ url, MRData: { RaceTable: { Races: [{ Results: [{ number: "1", position: "1", Driver: { code: "VER", givenName: "Max", familyName: "Verstappen" }, Constructor: { name: "Red Bull" }, status: "Finished", laps: "57", Time: { time: "1:30:00" } }] }] } } }));
  vi.stubGlobal("fetch", fetchMock);

  const { getSessionAnalytics } = await import("./data-api");
  const result = await getSessionAnalytics({ season: 2026, round: 2, sessionKey: 999, sessionCode: "R", fastF1Only: true });

  expect(result.source).toBe("FastF1");
  expect(result.resultsSource).toBe("Jolpica");
  expect(result.results[0]?.code).toBe("VER");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("https://jolpica.test/ergast/f1/2026/2/results.json");
});

it("deduplicates concurrent provider cache misses", async () => {
  vi.stubEnv("JOLPICA_BASE_URL", "https://jolpica.test/ergast/f1");
  const fetchMock = vi.fn(async (url: string) => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return Response.json({ url });
  });
  vi.stubGlobal("fetch", fetchMock);

  const { getSeasonStandings } = await import("./data-api");
  await Promise.all([getSeasonStandings(2026), getSeasonStandings(2026)]);

  expect(fetchMock).toHaveBeenCalledTimes(2);
});
