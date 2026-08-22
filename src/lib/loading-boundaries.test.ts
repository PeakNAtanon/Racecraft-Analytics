import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeSegments = [
  "about",
  "analysis",
  "calendar",
  "circuits",
  "circuits/[circuit]",
  "compare",
  "cookies",
  "data",
  "diagnostics",
  "drivers",
  "drivers/[code]",
  "methodology",
  "privacy",
  "rounds/[round]",
  "rounds/[round]/[session]",
  "sources",
  "standings",
  "terms",
];

describe("route loading boundaries", () => {
  it.each(routeSegments)("keeps the %s skeleton local to its destination", (segment) => {
    expect(existsSync(resolve(process.cwd(), "src", "app", segment, "loading.tsx"))).toBe(true);
  });
});
