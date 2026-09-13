import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { AnalysisDataState } from "./analysis-data-state";
import { ErrorRecovery } from "./error-recovery";

it.each(["scheduled", "processing", "partial", "unavailable"] as const)("gives %s a recovery path and never fabricates an update time", state => {
  const html = renderToStaticMarkup(createElement(AnalysisDataState, { state, locale: "th", availableSessionHref: "/rounds/1/r" }));
  expect(html).toContain("เปิดเซสชันที่มีข้อมูล");
  expect(html).toContain('href="/rounds/1/r"');
  expect(html).toContain("ไม่มีเวลาอัปเดต");
});
it("renders actual update metadata when available", () => {
  const html = renderToStaticMarkup(createElement(AnalysisDataState, { state: "ready", locale: "en", updatedAt: "2026-03-08T12:00:00Z" }));
  expect(html).toContain('dateTime="2026-03-08T12:00:00Z"');
  expect(html).not.toContain("Check again");
});
it("offers retry without a replacement URL or raw error details", () => {
  const html = renderToStaticMarkup(createElement(ErrorRecovery, { reset: vi.fn() }));
  expect(html).toContain("Try again");
  expect(html).toContain("current URL and filters");
});
