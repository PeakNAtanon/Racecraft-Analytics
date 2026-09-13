import { afterEach, expect, it, vi } from "vitest";
import { getWebSeasons, isWebSeasonVisible, resolveWebSeason } from "./web-seasons";

afterEach(() => vi.unstubAllEnvs());

it("falls back to the current season when the temporary visibility flag is empty", () => {
  vi.stubEnv("WEB_SEASONS", "");
  vi.stubEnv("F1_SEASON", "2026");
  expect(getWebSeasons()).toEqual([2026]);
});

it("limits web seasons and resolves hidden URLs to the active season", () => {
  vi.stubEnv("WEB_SEASONS", "2026");
  expect(getWebSeasons()).toEqual([2026]);
  expect(isWebSeasonVisible(2025)).toBe(false);
  expect(resolveWebSeason("2025")).toBe(2026);
  expect(resolveWebSeason("2026")).toBe(2026);
});
