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
  it("uses provider truth instead of inventing a fixed grid size", () => {
    const complete = buildDiagnosticCheck(category({}));
    const partial = buildDiagnosticCheck(category({ count: 11 }));

    expect(complete.status).toBe("live");
    expect(complete.expected).toBeUndefined();
    expect(complete.coverage).toBeUndefined();
    expect(complete.endpoint).toBe("https://api.jolpi.ca/ergast/f1/2026/drivers.json");
    expect(partial.status).toBe("live");
    expect(partial.coverage).toBeUndefined();
  });

  it("marks worker artifacts as processing and records their scope", () => {
    const check = buildDiagnosticCheck(category({ id: "telemetry", label: "Telemetry", provider: "FastF1 worker", status: "worker", count: 0 }));
    expect(check.status).toBe("processing");
    expect(check.reason).toContain("Worker artifact");
  });

  it("reports Laps and Stints coverage as all-driver data", () => {
    const check = buildDiagnosticCheck(category({ id: "laps", label: "Laps & Timing", provider: "OpenF1", count: 120 }));
    expect(check.scope).toBe("latest session · all drivers");
    expect(check.reason).toContain("all drivers returned by OpenF1");
  });

  it("treats OpenF1 post-session withholding as processing, not an outage", () => {
    const check = buildDiagnosticCheck(category({ id: "weather", label: "Weather", provider: "OpenF1", status: "awaiting_data", statusLabel: "POST-SESSION PENDING", count: 0 }));
    expect(check.status).toBe("processing");
    expect(check.reason).toContain("publishes session data after the session");
  });

  it("marks race-only Overtakes as not applicable outside a Race session", () => {
    const check = buildDiagnosticCheck(category({ id: "overtakes", label: "Overtakes", provider: "OpenF1", status: "not_applicable", statusLabel: "NOT APPLICABLE", count: 0 }));
    expect(check.status).toBe("not_applicable");
    expect(check.reason).toContain("only available for Race sessions");
  });

  it("uses readable labels for API consumers and UI", () => {
    expect(diagnosticStatusLabel("not_configured")).toBe("NOT CONFIGURED");
    expect(diagnosticStatusLabel("not_applicable")).toBe("NOT APPLICABLE");
  });
});
