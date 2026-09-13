import json
import pytest

from racecraft_ingest.fastf1_adapter import FastF1Adapter


class FakeFrame:
    def __init__(self, rows):
        self.rows = rows

    def to_dict(self, _orient):
        return self.rows


@pytest.mark.parametrize("invalid", [{"IsAccurate": False}, {"Deleted": True}, {"TrackStatus": "4"}, {"PitInTime": "00:01:00"}, {"PitOutTime": "00:01:00"}])
def test_telemetry_and_sectors_use_the_same_validated_laps(tmp_path, monkeypatch, invalid):
    import pandas as pd
    from fastf1.core import Lap, Laps

    rows = [dict(Driver="VER", DriverNumber="1", LapNumber=i,
                 LapTime=pd.Timedelta(f"{time}s"),
                 Sector1Time=pd.Timedelta(f"{sector}s"), Sector2Time=pd.Timedelta(f"{sector}s"), Sector3Time=pd.Timedelta(f"{sector}s"),
                 TrackStatus="1", IsAccurate=accurate, IsPersonalBest=not accurate,
                 Deleted=False, PitInTime=pd.NaT, PitOutTime=pd.NaT, Stint=1, Compound="SOFT")
            for i, time, sector, accurate in [(1, 90, 30, True), (2, 60, 20, False)]]
    rows[1].update({"IsAccurate": True, **invalid})
    monkeypatch.setattr(Lap, "get_telemetry", lambda lap: pd.DataFrame([{
        "Date": pd.Timestamp("2026-01-01"), "Speed": 100 * int(lap["LapNumber"]), "Throttle": 50, "Brake": False, "nGear": 4,
    }]))
    session = type("Session", (), {"laps": Laps(pd.DataFrame(rows)), "name": "Race"})()
    artifact = FastF1Adapter(str(tmp_path)).export_session_artifact(session, str(tmp_path / "session.json"), 2026, 1, "R")
    assert artifact["metrics"][0]["bestLap"] == 90
    assert artifact["metrics"][0]["theoreticalBest"] == 90
    assert artifact["telemetryByDriver"]["VER"]["samples"][0]["speed"] == 100


def test_export_session_artifact_contains_fastf1_metrics(tmp_path):
    rows = [
        {"Driver": "VER", "LapNumber": 1, "LapTime": 80.0, "Sector1Time": 20.0, "Sector2Time": 30.0, "Sector3Time": 30.0, "TrackStatus": "1", "IsAccurate": True},
        {"Driver": "VER", "LapNumber": 2, "LapTime": 80.2, "Sector1Time": 20.1, "Sector2Time": 30.0, "Sector3Time": 30.1, "TrackStatus": "1", "IsAccurate": True},
    ]
    weather = [{"Time": "2026-08-22 14:00:00", "AirTemp": 22.5, "TrackTemp": 31.0, "Humidity": 58.0, "WindSpeed": 2.1, "WindDirection": 180, "Rainfall": False}]
    session = type("FakeSession", (), {"laps": FakeFrame(rows), "weather_data": FakeFrame(weather), "name": "Race"})()
    destination = tmp_path / "2026" / "1" / "R" / "session.json"

    artifact = FastF1Adapter(str(tmp_path / "cache")).export_session_artifact(session, str(destination), 2026, 1, "R")

    assert artifact["provider"] == "FastF1"
    assert artifact["schemaVersion"] == "fastf1-session-v6"
    assert artifact["metrics"][0]["validLaps"] == 2
    assert artifact["dataQuality"]["validLaps"] == 2
    assert artifact["weather"]["latest"]["trackTemperature"] == 31.0
    assert json.loads(destination.read_text(encoding="utf-8"))["pace"]["laps"] == [1, 2]



def test_export_session_artifact_omits_laps_without_any_validated_value(tmp_path):
    rows = [
        {"Driver": "VER", "LapNumber": 1, "LapTime": 80.0, "TrackStatus": "1", "IsAccurate": True},
        {"Driver": "VER", "LapNumber": 2, "LapTime": 81.0, "TrackStatus": "4", "IsAccurate": True},
        {"Driver": "HAM", "LapNumber": 3, "LapTime": 82.0, "TrackStatus": "1", "IsAccurate": True},
    ]
    session = type("FakeSession", (), {"laps": FakeFrame(rows), "name": "Qualifying"})()
    destination = tmp_path / "2026" / "1" / "Q" / "session.json"

    artifact = FastF1Adapter(str(tmp_path / "cache")).export_session_artifact(session, str(destination), 2026, 1, "Q")

    assert artifact["pace"]["laps"] == [1, 3]
    ver_series = next(series for series in artifact["pace"]["series"] if series["code"] == "VER")
    assert ver_series["values"] == [80.0, None]


def test_export_session_artifact_reports_driver_data_gaps(tmp_path):
    rows = [
        {"Driver": "VER", "LapNumber": 1, "LapTime": 80.0, "TrackStatus": "1", "IsAccurate": True},
        {"Driver": "HAM", "LapNumber": 2, "LapTime": 81.0, "TrackStatus": "4", "IsAccurate": True},
    ]
    results = [
        {"Driver": "VER", "Position": 1},
        {"Driver": "HAM", "Position": 2},
        {"Driver": "RUS", "Position": 3},
    ]
    session = type("FakeSession", (), {"laps": FakeFrame(rows), "results": FakeFrame(results), "name": "Race"})()
    destination = tmp_path / "2026" / "1" / "R" / "session.json"

    artifact = FastF1Adapter(str(tmp_path / "cache")).export_session_artifact(session, str(destination), 2026, 1, "R")

    availability = artifact["driverAvailability"]
    assert set(availability) == {"VER", "HAM", "RUS"}
    assert availability["VER"]["status"] == "no_telemetry"
    assert availability["HAM"]["status"] == "no_valid_laps"
    assert availability["RUS"]["status"] == "no_laps"
    assert artifact["dataQuality"]["driversSeen"] == 3


@pytest.mark.parametrize("distances", [[-0.2, 14.25, 130.5], [None, float("nan"), float("inf")]])
def test_telemetry_preserves_only_provider_distance(tmp_path, monkeypatch, distances):
    import pandas as pd
    from types import SimpleNamespace
    from racecraft_ingest import fastf1_adapter

    frame = pd.DataFrame({
        "Date": pd.date_range("2024-05-05", periods=3, freq="1s"),
        "Speed": [100, 110, 120], "Distance": distances,
    })
    monkeypatch.setattr(fastf1_adapter, "_validated_fastest", lambda *args: SimpleNamespace(get_telemetry=lambda: frame))
    trace = fastf1_adapter._telemetry_snapshot(object(), "VER", tmp_path)
    assert trace is not None
    if distances[0] is not None:
        assert [sample["distance"] for sample in trace["samples"]] == distances
        assert "distance" in trace["fields"]
    else:
        assert all("distance" not in sample for sample in trace["samples"])
        assert "distance" not in trace["fields"]
    assert trace["samples"][0]["speed"] == 100
    assert pd.read_parquet(trace["parquetPath"]).shape[0] == 3


def test_telemetry_without_distance_does_not_integrate_speed(tmp_path, monkeypatch):
    import pandas as pd
    from types import SimpleNamespace
    from racecraft_ingest import fastf1_adapter

    frame = pd.DataFrame({"Date": pd.date_range("2024-05-05", periods=2, freq="1s"), "Speed": [100, 120]})
    monkeypatch.setattr(fastf1_adapter, "_validated_fastest", lambda *args: SimpleNamespace(get_telemetry=lambda: frame))
    trace = fastf1_adapter._telemetry_snapshot(object(), "VER", tmp_path)
    assert trace["fields"] == ["speed"]
    assert all("distance" not in sample for sample in trace["samples"])
