import { describe, expect, it } from "vitest";
import { defaultTimezone, displayTimezone, isTimezone, isTimezoneMode, timezoneShortLabel } from "./timezone";

describe("timezone selection", () => {
  it("keeps Bangkok as the safe default", () => {
    expect(defaultTimezone).toBe("Asia/Bangkok");
    expect(timezoneShortLabel(defaultTimezone)).toBe("ICT");
  });

  it("accepts configured IANA zones and rejects unknown values", () => {
    expect(isTimezone("Asia/Tokyo")).toBe(true);
    expect(isTimezone("America/Chicago")).toBe(true);
    expect(isTimezone("Not/AZone")).toBe(false);
    expect(isTimezone(undefined)).toBe(false);
  });

  it("exposes only personal and track time modes", () => {
    expect(isTimezoneMode("my")).toBe(true);
    expect(isTimezoneMode("track")).toBe(true);
    expect(isTimezoneMode("device")).toBe(false);
  });

  it("resolves track time from the circuit location", () => {
    expect(displayTimezone("track", defaultTimezone, "Japan", "Suzuka")).toBe("Asia/Tokyo");
    expect(displayTimezone("track", defaultTimezone, "USA", "Austin")).toBe("America/Chicago");
    expect(displayTimezone("my", "Europe/London", "Japan", "Suzuka")).toBe("Europe/London");
  });
});
