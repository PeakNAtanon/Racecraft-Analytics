import { afterEach, expect, it, vi } from "vitest";

const { readArtifact, schedule } = vi.hoisted(() => ({ readArtifact: vi.fn(async () => null), schedule: vi.fn() }));
vi.mock("./schedule", () => ({ getScheduleRounds: schedule }));
vi.mock("./fastf1-artifacts", () => ({ getFastF1SessionArtifact: readArtifact, getFastF1ArtifactInventory: async () => [{ round: 1, sessionCode: "R", status: "complete" }] }));
afterEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("maps a requested OpenF1 session to its own round, not the newest artifact", async () => {
  schedule.mockResolvedValue([{ round: 2, sessions: [{ sessionKey: 999, code: "R", name: "Race", startsAt: "2020-03-08", endsAt: "2020-03-09" }] }]);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
  const { getSessionAnalytics } = await import("./data-api");
  await getSessionAnalytics({ season: 2026, sessionKey: 999, sessionCode: "R" });
  expect(readArtifact).toHaveBeenCalledWith(expect.objectContaining({ round: 2, sessionKey: 999 }));
});

it("does not attach any artifact to an unknown session", async () => {
  schedule.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
  const { getSessionAnalytics } = await import("./data-api");
  await getSessionAnalytics({ season: 2026, sessionKey: 999, sessionCode: "R" });
  expect(readArtifact).not.toHaveBeenCalled();
});

it("rejects a session key that belongs to a different explicit round", async () => {
  schedule.mockResolvedValue([{ round: 1, sessions: [{ sessionKey: 999, code: "R", name: "Race" }] }]);
  const { getSessionAnalytics } = await import("./data-api");
  const result = await getSessionAnalytics({ season: 2026, round: 2, sessionKey: 999, sessionCode: "R" });
  expect(result.source).toBe("fallback");
  expect(readArtifact).not.toHaveBeenCalled();
});

it("does not select a session that has started but not finished", async () => {
  schedule.mockResolvedValue([{ round: 1, sessions: [
    { sessionKey: 100, code: "Q", name: "Qualifying", startsAt: "2020-03-07", endsAt: "2020-03-08" },
    { sessionKey: 101, code: "R", name: "Race", startsAt: "2020-03-09", endsAt: "2099-03-09" },
  ] }]);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
  const { getSessionAnalytics } = await import("./data-api");
  await getSessionAnalytics({ season: 2026 });
  expect(readArtifact).toHaveBeenCalledWith(expect.objectContaining({ round: 1, sessionKey: 100, sessionCode: "Q" }));
});
