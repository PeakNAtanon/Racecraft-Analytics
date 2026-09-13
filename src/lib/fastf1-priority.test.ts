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

it("keeps OpenF1-only session results linked to standings when its drivers endpoint is unavailable", async () => {
  vi.stubEnv("JOLPICA_BASE_URL", "https://jolpica.test/ergast/f1");
  vi.stubEnv("OPENF1_BASE_URL", "https://openf1.test/v1");
  const fetchMock = vi.fn(async (input: string) => {
    const url = String(input);
    if (url.endsWith("/sessions?year=2026")) {
      return Response.json([{ session_key: 10, session_name: "Practice 1", date_start: "2026-01-01T10:00:00Z", date_end: "2026-01-01T11:00:00Z", circuit_short_name: "Bahrain" }]);
    }
    if (url.endsWith("/2026.json")) return Response.json({ MRData: { RaceTable: { Races: [] } } });
    if (url.endsWith("/2026/driverstandings.json")) return Response.json({ MRData: { StandingsTable: { StandingsLists: [{ round: "1", DriverStandings: [{ position: "1", points: "25", wins: "1", Driver: { code: "NOR", givenName: "Lando", familyName: "Norris" }, Constructors: [{ name: "McLaren" }] }] }] } } });
    if (url.endsWith("/2026/drivers.json")) return Response.json({ MRData: { DriverTable: { Drivers: [{ code: "NOR", givenName: "Lando", familyName: "Norris", permanentNumber: "1" }] } } });
    if (url.includes("/drivers?session_key=10")) return Response.json([]);
    if (url.includes("/session_result?session_key=10")) return Response.json([{ driver_number: 1, position: 1, number_of_laps: 20 }]);
    return Response.json({});
  });
  vi.stubGlobal("fetch", fetchMock);

  const { getSeasonComparison } = await import("./data-api");
  const result = await getSeasonComparison(2026);

  expect(result.sessions[0]?.results[0]?.code).toBe("NOR");
  expect(result.sessions[0]?.resultsSource).toBe("OpenF1");
});
