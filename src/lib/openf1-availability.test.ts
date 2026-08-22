import { describe, expect, it } from "vitest";
import { getOpenF1PublicationState, openF1PublicationLabel } from "./openf1-availability";

describe("OpenF1 publication window", () => {
  const start = "2026-08-21T10:00:00Z";
  const end = "2026-08-21T12:00:00Z";

  it("treats a future session as not published yet", () => {
    expect(getOpenF1PublicationState(start, end, Date.parse("2026-08-21T09:59:59Z"))).toBe("not_started");
    expect(openF1PublicationLabel("not_started")).toBe("NOT PUBLISHED YET");
  });

  it("treats an active session as expected post-session withholding", () => {
    expect(getOpenF1PublicationState(start, end, Date.parse("2026-08-21T11:00:00Z"))).toBe("session_live");
    expect(openF1PublicationLabel("session_live")).toContain("POST-SESSION DATA");
  });

  it("keeps retrying after the session ends", () => {
    expect(getOpenF1PublicationState(start, end, Date.parse("2026-08-21T12:00:01Z"))).toBe("post_session_pending");
    expect(getOpenF1PublicationState(undefined, undefined, Date.parse("2026-08-21T12:00:01Z"))).toBe("post_session_pending");
  });
});
