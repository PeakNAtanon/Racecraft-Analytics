import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("calendar meeting matching", () => {
  it("keeps round 24 from a historical calendar when the local calendar has only 23 rounds", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.includes("/sessions?")
      ? [{ meeting_key: 1, session_key: 9839, session_name: "Race", date_start: "2025-12-07T13:00:00Z", date_end: "2025-12-07T15:00:00Z" }]
      : { MRData: { RaceTable: { Races: [{ round: "24", raceName: "Abu Dhabi Grand Prix", date: "2025-12-07", time: "13:00:00Z" }] } } })));
    const { getScheduleRounds } = await import("./schedule");
    const [round] = await getScheduleRounds(2025);
    expect(round.round).toBe(24);
    expect(round.season).toBe(2025);
    expect(round.sessions[0].sessionKey).toBe(9839);
  });
  it.each([3, 7, 8, 30])("only attaches a meeting within seven days (distance %i days)", async (days) => {
    const raceStart = "2026-03-08T04:00:00Z";
    const meetingStart = new Date(Date.parse(raceStart) + days * 86400000).toISOString();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.includes("/sessions?")
      ? [{ meeting_key: 1, session_key: 99, session_name: "Race", date_start: meetingStart, date_end: meetingStart }]
      : { MRData: { RaceTable: { Races: [{ round: "1", date: "2026-03-08", time: "04:00:00Z" }] } } })));
    const { getScheduleRounds } = await import("./schedule");
    const [round] = await getScheduleRounds(2026);
    expect(round.raceStartsAt).toBe(days <= 7 ? meetingStart : new Date(raceStart).toISOString());
    expect(round.sessions.some(session => session.sessionKey === 99)).toBe(days <= 7);
  });
});
