import { existsSync, readFileSync } from "node:fs";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteLoading } from "@/components/route-loading";
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

const boundaries = import.meta.glob("../app/**/loading.tsx", { eager: true }) as unknown as Record<string, { default: ComponentType }>;

describe("route loading boundaries", () => {
  it.each(Object.entries(boundaries))("renders %s without a skeleton", (_, boundary) => {
    const html = renderToStaticMarkup(createElement(boundary.default));
    expect(html).toContain('class="route-loading-status"');
    expect(html).toContain('role="status"');
    expect(html).not.toMatch(/skeleton|shimmer|<svg/);
  });
  it.each(routeSegments)("keeps the %s loading status local to its destination", (segment) => {
    expect(existsSync(resolve(process.cwd(), "src", "app", segment, "loading.tsx"))).toBe(true);
  });

  it("renders an accessible text status without placeholder blocks", () => {
    const html = renderToStaticMarkup(createElement(RouteLoading));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading data…");
    expect(html).toContain("กำลังโหลดข้อมูล…");
    expect(html).not.toMatch(/skeleton|shimmer|aria-hidden|<svg/);
  });

  it("removes placeholder styles and uses text loading on the home route", () => {
    expect(readFileSync(resolve("src/app/motion.css"), "utf8")).not.toMatch(/skeleton|shimmer/);
    expect(readFileSync(resolve("src/app/globals.css"), "utf8")).not.toContain("driver-loading");
    expect(readFileSync(resolve("src/app/loading.tsx"), "utf8")).toContain("<RouteLoading");
  });
});
