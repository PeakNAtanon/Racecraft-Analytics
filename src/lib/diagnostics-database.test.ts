import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { query, end, connect } = vi.hoisted(() => {
  const query = vi.fn();
  const end = vi.fn();
  return { query, end, connect: vi.fn(() => Object.assign(query, { end })) };
});
vi.mock("postgres", () => ({ default: connect }));
vi.mock("./data-api", () => ({ getDataHub: vi.fn(async () => ({ season: 2026, categories: [] })) }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://user:secret@localhost/racecraft");
  query.mockResolvedValue([{ ok: 1 }]);
  end.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function databaseCheck() {
  const { getCompletenessSnapshot } = await import("./diagnostics");
  return (await getCompletenessSnapshot()).checks.find(check => check.id === "database");
}

it("reports a configured but unreachable database as unavailable without leaking credentials", async () => {
  query.mockRejectedValue(new Error("failed postgres://user:secret@localhost/racecraft"));
  const check = await databaseCheck();
  expect(check?.status).toBe("unavailable");
  expect(JSON.stringify(check)).not.toContain("secret");
  expect(end).toHaveBeenCalled();
});

it("only marks the database live after a successful query and closes the connection", async () => {
  expect((await databaseCheck())?.status).toBe("live");
  expect(query).toHaveBeenCalledTimes(1);
  expect(end).toHaveBeenCalled();
});

it("does not connect when DATABASE_URL is missing", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect((await databaseCheck())?.status).toBe("not_configured");
  expect(connect).not.toHaveBeenCalled();
});

it("bounds a stalled query and closes its connection", async () => {
  vi.useFakeTimers();
  query.mockImplementationOnce(() => new Promise(() => {}));
  const pending = databaseCheck();
  await vi.waitFor(() => expect(query).toHaveBeenCalled());
  await vi.advanceTimersByTimeAsync(4001);
  expect((await pending)?.status).toBe("unavailable");
  expect(end).toHaveBeenCalledWith({ timeout: 1 });
});
