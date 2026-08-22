from __future__ import annotations
import argparse, asyncio, json
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from .config import Settings
from .fastf1_adapter import FASTF1_ARTIFACT_SCHEMA_VERSION, FastF1Adapter
from .providers import JolpicaProvider, OpenF1Provider, canonical_session_code
from .rss import fetch_feed
from .repository import Repository


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _fastf1_session_code(code: str) -> str:
    return "S" if code.upper() == "SPR" else code.upper()


def _artifact_is_current(path: Path) -> bool:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return isinstance(payload, dict) and payload.get("schemaVersion") == FASTF1_ARTIFACT_SCHEMA_VERSION


def _session_round(calendar: dict[str, Any] | None, session: dict[str, Any]) -> int | None:
    races = calendar.get("MRData", {}).get("RaceTable", {}).get("Races", []) if calendar else []
    starts_at = _parse_datetime(session.get("date_start"))
    if starts_at is None:
        return None
    closest: tuple[float, int] | None = None
    for race in races:
        race_date = _parse_datetime(f"{race.get('date')}T{race.get('time', '00:00:00Z')}")
        if race_date is None:
            continue
        distance = abs((race_date - starts_at).total_seconds())
        if closest is None or distance < closest[0]:
            closest = (distance, int(race.get("round", 0) or 0))
    return closest[1] if closest and closest[0] <= 7 * 86400 and closest[1] > 0 else None


def _run_fastf1(settings: Settings, calendar: dict[str, Any] | None, sessions: list[dict[str, Any]]) -> dict[str, Any]:
    """Process one missing published session per worker cycle.

    Processing one artifact at a time keeps the cache and CPU bounded. The
    next ten-minute cycle continues the backlog without duplicating files.
    """
    if not settings.fastf1_enabled:
        return {"state": "disabled", "processed": 0, "pending": 0}
    now = datetime.now(timezone.utc)
    candidates = []
    for row in sessions:
        code = canonical_session_code(row.get("session_name") or row.get("session_type"))
        starts_at = _parse_datetime(row.get("date_start"))
        ends_at = _parse_datetime(row.get("date_end"))
        if not code or starts_at is None or ends_at is None or ends_at > now:
            continue
        round_number = _session_round(calendar, row)
        if round_number is not None:
            candidates.append((ends_at, round_number, code, row))
    candidates.sort(key=lambda item: item[0])
    adapter = FastF1Adapter(settings.fastf1_cache)
    pending = 0
    for _, round_number, code, _ in candidates:
        destination = adapter.artifact_path(settings.telemetry_storage, settings.season, round_number, _fastf1_session_code(code))
        if destination.exists() and destination.stat().st_size > 0 and _artifact_is_current(destination):
            continue
        pending += 1
        try:
            session = adapter.load(settings.season, round_number, _fastf1_session_code(code))
            artifact = adapter.export_session_artifact(session, str(destination), settings.season, round_number, code)
            return {"state": "complete", "processed": 1, "pending": max(0, pending - 1), "round": round_number, "session_code": code, "artifact": str(destination), "drivers": len(artifact.get("metrics", []))}
        except Exception as exc:  # provider/library errors must not erase prior snapshots
            return {"state": "telemetry_processing", "processed": 0, "pending": pending, "round": round_number, "session_code": code, "error": f"{type(exc).__name__}: {exc}"}
    return {"state": "complete" if candidates else "awaiting_data", "processed": 0, "pending": pending}

async def run_once(settings: Settings) -> dict:
    jolpica = JolpicaProvider(settings.jolpica_url, settings.user_agent)
    openf1 = OpenF1Provider(settings.openf1_url, settings.user_agent)
    calendar, sessions, feeds = await asyncio.gather(
        jolpica.calendar(settings.season), openf1.sessions(settings.season),
        asyncio.gather(*(fetch_feed(url, settings.user_agent) for url in settings.rss_feeds), return_exceptions=True),
        return_exceptions=True,
    )
    good_feeds=[(url,result) for url,result in zip(settings.rss_feeds,feeds) if isinstance(result,list)]
    news = [asdict(item) for _,result in good_feeds for item in result]
    persisted={"calendar":0,"sessions":0,"news":0,"telemetry_artifacts":0}
    repository = Repository(settings.database_url) if settings.database_url else None
    if repository:
        if isinstance(calendar,dict): persisted["calendar"]=await asyncio.to_thread(repository.upsert_calendar,settings.season,calendar)
        if isinstance(sessions,list): persisted["sessions"]=await asyncio.to_thread(repository.upsert_sessions,settings.season,sessions)
        for url,items in good_feeds: persisted["news"]+=await asyncio.to_thread(repository.upsert_news,url,items)
    session_rows = sessions if isinstance(sessions,list) else []
    normalized_sessions = sum(1 for row in session_rows if row.get("session_key") is not None and canonical_session_code(row.get("session_name") or row.get("session_type")))
    openf1_ok = isinstance(sessions, list) and bool(session_rows)
    fastf1 = await asyncio.to_thread(_run_fastf1, settings, calendar if isinstance(calendar, dict) else None, session_rows)
    if repository and fastf1.get("state") == "complete" and fastf1.get("artifact"):
        persisted["telemetry_artifacts"] = await asyncio.to_thread(repository.upsert_telemetry_artifact, settings.season, int(fastf1["round"]), str(fastf1["session_code"]), str(fastf1["artifact"]), {"provider": "FastF1", "drivers": fastf1.get("drivers", 0), "state": fastf1["state"]})
    # OpenF1 is a post-session source. A closed endpoint during the event is
    # expected and should be retried by the ten-minute worker loop, not treated
    # as a destructive provider outage.
    pipeline_state = "telemetry_processing" if fastf1["state"] == "telemetry_processing" else "provisional" if openf1_ok else "awaiting_data"
    return {"season": settings.season, "calendar_ok": not isinstance(calendar, Exception), "openf1_ok": openf1_ok, "openf1_state": "published" if openf1_ok else "post_session_pending", "fastf1_state": fastf1["state"], "news_count": len(news), "diagnostics": {"calendar_records": len(calendar.get("MRData", {}).get("RaceTable", {}).get("Races", [])) if isinstance(calendar,dict) else 0, "openf1_records": len(session_rows), "openf1_normalized": normalized_sessions, "fastf1_pending": fastf1.get("pending", 0)}, "persisted":persisted,"state": pipeline_state, "fastf1": fastf1, "news": news[:5]}

def main() -> None:
    parser=argparse.ArgumentParser(); parser.add_argument("--once", action="store_true"); args=parser.parse_args()
    settings=Settings()
    if args.once: print(json.dumps(asyncio.run(run_once(settings)), default=str, ensure_ascii=False))
    else:
        while True:
            print(json.dumps(asyncio.run(run_once(settings)), default=str, ensure_ascii=False)); asyncio.run(asyncio.sleep(600))

if __name__ == "__main__": main()
