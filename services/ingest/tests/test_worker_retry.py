import json
import pytest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from racecraft_ingest import main as worker


@pytest.mark.parametrize("provider_result", [RuntimeError("OpenF1 unavailable"), []])
def test_backfill_uses_saved_sessions_when_provider_is_unavailable(monkeypatch, provider_result):
    settings = replace(worker.Settings(), database_url="test", rss_feeds=())
    calendar = {"MRData": {"RaceTable": {"Races": []}}}
    saved = [{"session_name": "R", "date_start": "2020-03-08T12:00:00+00:00", "date_end": "2020-03-08T14:00:00+00:00"}]
    provider = Mock()
    provider.calendar = AsyncMock(return_value=calendar)
    provider.sessions = AsyncMock(**({"side_effect": provider_result} if isinstance(provider_result, Exception) else {"return_value": provider_result}))
    monkeypatch.setattr(worker, "JolpicaProvider", lambda *args: provider)
    monkeypatch.setattr(worker, "OpenF1Provider", lambda *args: provider)
    repository = Mock()
    repository.upsert_calendar.return_value = 0
    repository.upsert_sessions.return_value = 0
    repository.get_completed_sessions.return_value = saved
    monkeypatch.setattr(worker, "Repository", lambda *args: repository)
    backfill = Mock(return_value={"state": "complete", "processed": 1, "pending": 10})
    monkeypatch.setattr(worker, "_run_fastf1", backfill)
    result = worker.asyncio.run(worker.run_once(settings))
    assert backfill.call_args.args[2] == saved
    assert result["openf1_ok"] is False
    assert result["diagnostics"]["session_source"] == "database"
    repository.get_completed_sessions.assert_called_once_with(settings.season)

def test_worker_rotates_years_without_changing_once_default(monkeypatch):
    settings = replace(worker.Settings(), season=2026, ingest_seasons=(2026, 2025, 2024, 2023))
    monkeypatch.setattr(worker, "Settings", lambda: settings)
    monkeypatch.setattr("sys.argv", ["racecraft-ingest"])
    years = []
    async def run_once(current):
        years.append(current.season)
        if len(years) == 5:
            raise KeyboardInterrupt
        return {"fastf1": {"processed": 1, "pending": 10}}
    async def sleep(seconds):
        pass
    monkeypatch.setattr(worker, "run_once", run_once)
    monkeypatch.setattr(worker.asyncio, "sleep", sleep)
    with pytest.raises(KeyboardInterrupt):
        worker.main()
    assert years == [2026, 2025, 2024, 2023, 2026]
    years.clear()
    monkeypatch.setattr("sys.argv", ["racecraft-ingest", "--once"])
    worker.main()
    assert years == [2026]


def test_backfill_continues_promptly_after_progress_or_a_failed_attempt():
    assert worker._next_cycle_delay({"fastf1": {"pending": 67, "processed": 1}}) == 30
    assert worker._next_cycle_delay({"fastf1": {"pending": 67, "error": "not published"}}) == 30


def test_idle_disabled_and_cooling_queues_keep_normal_polling():
    for fastf1 in [
        {"pending": 0, "processed": 1},
        {"pending": 0, "state": "disabled"},
        {"pending": 2, "state": "telemetry_processing"},
    ]:
        assert worker._next_cycle_delay({"fastf1": fastf1}) == 600


def test_worker_refreshes_v5_for_distance_support(tmp_path):
    path = tmp_path / "session.json"
    path.write_text(json.dumps({"schemaVersion": "fastf1-session-v5"}))
    assert not worker._artifact_is_current(path)
    path.write_text(json.dumps({"schemaVersion": "fastf1-session-v6"}))
    assert worker._artifact_is_current(path)


def test_failed_session_does_not_block_older_artifacts(tmp_path, monkeypatch):
    clock = Mock(return_value=100.0)
    monkeypatch.setattr(worker, "monotonic", clock, raising=False)
    monkeypatch.setattr(worker, "_fastf1_retry_after", {}, raising=False)
    settings = SimpleNamespace(fastf1_enabled=True, fastf1_cache=str(tmp_path), telemetry_storage=str(tmp_path), season=2026)
    calendar = {"MRData": {"RaceTable": {"Races": [{"round": "1", "date": "2020-03-08", "time": "12:00:00Z"}]}}}
    sessions = [
        {"session_name": "Qualifying", "date_start": "2020-03-07T12:00:00Z", "date_end": "2020-03-07T13:00:00Z"},
        {"session_name": "Race", "date_start": "2020-03-08T12:00:00Z", "date_end": "2020-03-08T14:00:00Z"},
    ]
    adapter = Mock()
    adapter.artifact_path.side_effect = lambda root, season, round_number, code: tmp_path / code / "session.json"
    adapter.load.side_effect = [RuntimeError("not published"), object(), RuntimeError("still pending")]
    def publish(session, destination, season, round_number, code):
        path = Path(destination)
        path.parent.mkdir(parents=True, exist_ok=True)
        artifact = {"schemaVersion": worker.FASTF1_ARTIFACT_SCHEMA_VERSION, "metrics": []}
        path.write_text(json.dumps(artifact))
        return artifact

    adapter.export_session_artifact.side_effect = publish
    monkeypatch.setattr(worker, "FastF1Adapter", lambda cache: adapter)

    failed = worker._run_fastf1(settings, calendar, sessions)
    assert failed["state"] == "telemetry_processing"
    cooling = worker._run_fastf1(settings, calendar, sessions[-1:])
    assert cooling["state"] == "telemetry_processing"
    assert cooling["pending"] == 1
    assert adapter.load.call_count == 1
    clock.return_value = 700.0
    result = worker._run_fastf1(settings, calendar, sessions)
    assert result["session_code"] == "Q"
    assert failed["pending"] == 2
    assert result["processed"] == 1
    assert result["pending"] == 1
    clock.return_value = 1301.0
    worker._run_fastf1(settings, calendar, sessions)
    assert [call.args[2] for call in adapter.load.call_args_list] == ["R", "Q", "R"]


def test_multiple_failures_do_not_starve_unattempted_sessions(tmp_path, monkeypatch):
    clock = Mock(return_value=100.0)
    monkeypatch.setattr(worker, "monotonic", clock)
    monkeypatch.setattr(worker, "_fastf1_retry_after", {})
    settings = SimpleNamespace(fastf1_enabled=True, fastf1_cache=str(tmp_path), telemetry_storage=str(tmp_path), season=2026)
    calendar = {"MRData": {"RaceTable": {"Races": [{"round": "1", "date": "2020-03-08", "time": "12:00:00Z"}]}}}
    sessions = [
        {"session_name": name, "date_start": f"2020-03-0{day}T12:00:00Z", "date_end": f"2020-03-0{day}T14:00:00Z"}
        for name, day in [("Practice 1", 6), ("Qualifying", 7), ("Race", 8)]
    ]
    adapter = Mock()
    adapter.artifact_path.side_effect = lambda root, season, round_number, code: tmp_path / code / "session.json"
    adapter.load.side_effect = RuntimeError("not published")
    monkeypatch.setattr(worker, "FastF1Adapter", lambda cache: adapter)
    for now in [100.0, 700.0, 1301.0]:
        clock.return_value = now
        worker._run_fastf1(settings, calendar, sessions)
    assert [call.args[2] for call in adapter.load.call_args_list] == ["R", "Q", "FP1"]
