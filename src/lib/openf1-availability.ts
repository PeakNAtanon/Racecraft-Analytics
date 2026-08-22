export type OpenF1PublicationState = "not_started" | "session_live" | "post_session_pending";

/**
 * OpenF1 is treated as a post-session source by this application. During an
 * active session an empty/failed response is expected, not a hard outage.
 */
export function getOpenF1PublicationState(startsAt?: string, endsAt?: string, now = Date.now()): OpenF1PublicationState {
  const start = startsAt ? Date.parse(startsAt) : Number.NaN;
  const end = endsAt ? Date.parse(endsAt) : Number.NaN;

  if (Number.isFinite(start) && now < start) return "not_started";
  if (Number.isFinite(end) && now <= end) return "session_live";
  return "post_session_pending";
}

export function openF1PublicationLabel(state: OpenF1PublicationState) {
  if (state === "not_started") return "NOT PUBLISHED YET";
  if (state === "session_live") return "SESSION LIVE · POST-SESSION DATA";
  return "POST-SESSION · RETRYING";
}

