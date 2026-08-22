import { describe, expect, it } from "vitest";
import { buildDiagnosticCheck, diagnosticStatusLabel } from "./diagnostics";
import type { DataCategory } from "./data-api";

function category(overrides: Partial<DataCategory>): DataCategory {
  return {
    id: "drivers",
    label: "Drivers",
    description: "driver records",
    provider: "Jolpica",
    endpoint: "https://api.jolpi.ca/ergast/f1/2026/drivers.json?token=should-not-be-returned",
    status: "live",
    statusLabel: "API LIVE",
    count: 22,
    columns: [],
    rows: [],
    ...overrides,
  };
}

describe("data completeness diagnostics", () => {
  it("reports full and partial expected-grid coverage without exposing query secrets", () => {
    const complete = buildDiagnosticCheck(category({}));
    const partial = buildDiagnosticCheck(category({ count: 11 }));

    expect(complete.status).toBe("live");
    expect(complete.coverage).toBe(100);
    expect(complete.endpoint).toBe("https://api.jolpi.ca/ergast/f1/2026/drivers.json");
    expect(partial.status).toBe("partial");
    expect(partial.coverage).toBe(50);
  });

  it("marks worker artifacts as processing and records their scope", () => {
    const check = buildDiagnosticCheck(category({ id: "telemetry", label: "Telemetry", provider: "FastF1 worker", status: "worker", count: 0 }));
    expect(check.status).toBe("processing");
    expect(check.reason).toContain("Worker artifact");
  });

  it("treats OpenF1 post-session withholding as processing, not an outage", () => {
    const check = buildDiagnosticCheck(category({ id: "weather", label: "Weather", provider: "OpenF1", status: "awaiting_data", statusLabel: "POST-SESSION PENDING", count: 0 }));
    expect(check.status).toBe("processing");
    expect(check.reason).toContain("publishes session data after the session");
  });

  it("uses readable labels for API consumers and UI", () => {
    expect(diagnosticStatusLabel("not_configured")).toBe("NOT CONFIGURED");
  });
});
