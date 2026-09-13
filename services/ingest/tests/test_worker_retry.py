import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from racecraft_ingest import main as worker


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
