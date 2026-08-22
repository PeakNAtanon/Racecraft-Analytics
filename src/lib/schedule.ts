import { rounds as fallbackRounds } from "./data";
import { DataStatus, Round, SessionCode, SessionInfo } from "./types";
import { canonicalSessionCode } from "./session-code";

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown) => value === null || value === undefined ? "" : String(value);
const nested = (value: unknown, ...keys: string[]) => keys.reduce<unknown>((current, key) => Array.isArray(current) ? current[Number(key)] : record(current)[key], value);
const list = (value: unknown): JsonRecord[] => Array.isArray(value) ? value.map(record) : [];

function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(record);
  const source = record(value);
  const columns = Object.entries(source).filter(([, entry]) => Array.isArray(entry));
  if (!columns.length) return [];
  const length = Math.max(...columns.map(([, entry]) => (entry as unknown[]).length));
  return Array.from({ length }, (_, index) => Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, Array.isArray(entry) ? entry[index] : entry])));
}

async function fetchJson(url: string): Promise<unknown | undefined> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": process.env.PROVIDER_USER_AGENT ?? "RacecraftAnalytics/0.1" },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) return response.json();
      if (response.status !== 429 && response.status < 500) return undefined;
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) ? Math.min(10000, Math.max(350, retryAfter * 1000)) : 500 * 2 ** attempt));
    } catch {
      if (attempt === 2) return undefined;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  return undefined;
}

function sessionCode(value: JsonRecord): SessionCode | undefined {
  return canonicalSessionCode(value.session_name ?? value.session_type);
}

function statusFor(startsAt: string, endsAt?: string): DataStatus {
  const now = Date.now();
  const start = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : Number.NaN;
  if (!Number.isFinite(start) || now < start) return "scheduled";
  if (Number.isFinite(end) && now <= end) return "provisional";
  return "complete";
}

function fallbackSession(session: SessionInfo): SessionInfo {
  const timedStatus = statusFor(session.startsAt, session.endsAt);
  // OpenF1 withholds session payloads while the event is running and may keep
  // them closed briefly after the chequered flag. A time-only fallback must
  // not claim that the data is complete just because the clock has elapsed.
  return { ...session, status: timedStatus === "complete" ? "awaiting_data" : timedStatus, source: "fallback" };
}

function raceStart(value: JsonRecord, fallback: string) {
  const date = text(value.date);
  if (!date) return fallback;
  const time = text(value.time) || "00:00:00Z";
  const raw = `${date}T${time}`;
  const candidate = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(time) ? raw : `${raw}Z`);
  return Number.isNaN(candidate.getTime()) ? fallback : candidate.toISOString();
}

function applyRaceMetadata(round: Round, race: JsonRecord | undefined): Round {
  if (!race) return { ...round, sessions: round.sessions.map(fallbackSession) };
  const circuit = record(race.Circuit);
  const location = record(circuit.Location);
  return {
    ...round,
    name: text(race.raceName) || round.name,
    raceStartsAt: raceStart(race, round.raceStartsAt),
    circuit: {
      ...round.circuit,
      name: text(circuit.circuitName) || round.circuit.name,
      locality: text(location.locality) || round.circuit.locality,
      country: text(location.country) || round.circuit.country,
    },
    sessions: round.sessions.map(fallbackSession),
  };
}

export async function getScheduleRounds(season = Number(process.env.F1_SEASON ?? "2026")): Promise<Round[]> {
  const jolpica = (process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1").replace(/\/$/, "");
  const openf1 = (process.env.OPENF1_BASE_URL ?? "https://api.openf1.org/v1").replace(/\/$/, "");
  const [calendar, sessions] = await Promise.all([
    fetchJson(`${jolpica}/${season}.json`),
    fetchJson(`${openf1}/sessions?year=${season}`),
  ]);
  const races = list(nested(calendar, "MRData", "RaceTable", "Races"));
  const sessionRows: Array<{ row: JsonRecord; code: SessionCode }> = records(sessions).flatMap(row => {
    const code = sessionCode(row);
    return code ? [{ row, code }] : [];
  });
  const groupedMeetings = new Map<string, Array<JsonRecord & { code: SessionCode }>>();
  for (const item of sessionRows) {
    const meetingKey = text(item.row.meeting_key);
    const rows = groupedMeetings.get(meetingKey) ?? [];
    rows.push({ ...item.row, code: item.code });
    groupedMeetings.set(meetingKey, rows);
  }
  const meetings = [...groupedMeetings.values()]
    .map(rows => rows.sort((a, b) => Date.parse(text(a.date_start)) - Date.parse(text(b.date_start))))
    .filter(rows => rows.some(row => row.code === "R"))
    .sort((a, b) => Date.parse(text(a[0]?.date_start)) - Date.parse(text(b[0]?.date_start)));

  const availableMeetings = new Set(meetings);
  const matchMeeting = (race: JsonRecord) => {
    const raceAt = Date.parse(raceStart(race, ""));
    if (!Number.isFinite(raceAt)) return undefined;
    let match: (typeof meetings)[number] | undefined;
    let distance = Number.POSITIVE_INFINITY;
    for (const meeting of availableMeetings) {
      const meetingRace = meeting.find(session => session.code === "R");
      const meetingAt = Date.parse(text(meetingRace?.date_start));
      const currentDistance = Math.abs(meetingAt - raceAt);
      if (Number.isFinite(meetingAt) && currentDistance < distance) {
        distance = currentDistance;
        match = meeting;
      }
    }
    if (match && distance <= 7 * 86400000) availableMeetings.delete(match);
    return match;
  };

  const calendarRounds = races.length ? races.map((raceRecord, index) => ({ raceRecord, fallback: fallbackRounds.find(round => round.round === Number(raceRecord.round)) ?? fallbackRounds[index] ?? fallbackRounds[0] })) : fallbackRounds.map(fallback => ({ raceRecord: undefined, fallback }));
  return calendarRounds.map(({ raceRecord, fallback }) => {
    const round = applyRaceMetadata({ ...fallback, season }, raceRecord);
    const meeting = raceRecord ? matchMeeting(raceRecord) : undefined;
    if (!meeting?.length) return round;
    const apiSessions = meeting.map(row => {
      const startsAt = text(row.date_start);
      const endsAt = text(row.date_end) || undefined;
      return {
        code: row.code,
        name: text(row.session_name) || row.code,
        startsAt,
        endsAt,
        status: statusFor(startsAt, endsAt),
        sessionKey: Number(row.session_key) || undefined,
        source: "OpenF1" as const,
      };
    }).filter(session => session.startsAt);
    const raceSession = apiSessions.find(session => session.code === "R");
    return { ...round, raceStartsAt: raceSession?.startsAt ?? round.raceStartsAt, sessions: apiSessions };
  });
}

export async function getScheduleRound(value: string): Promise<Round | undefined> {
  const schedule = await getScheduleRounds();
  return schedule.find(round => round.round === Number(value) || round.slug === value);
}

export function currentScheduleRound(schedule: Round[], now = new Date()): Round {
  const current = schedule.find(round => {
    const firstSessionAt = Date.parse(round.sessions[0]?.startsAt ?? round.raceStartsAt);
    const raceAt = Date.parse(round.raceStartsAt);
    return now.getTime() >= firstSessionAt - 7 * 86400000 && now.getTime() <= raceAt + 48 * 3600000;
  });
  return current ?? schedule.find(round => now.getTime() < Date.parse(round.sessions[0]?.startsAt ?? round.raceStartsAt) - 7 * 86400000) ?? schedule[schedule.length - 1];
}
