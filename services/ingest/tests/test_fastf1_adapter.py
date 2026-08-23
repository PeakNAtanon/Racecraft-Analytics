import json

from racecraft_ingest.fastf1_adapter import FastF1Adapter


class FakeFrame:
    def __init__(self, rows):
        self.rows = rows

    def to_dict(self, _orient):
        return self.rows


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
    assert artifact["schemaVersion"] == "fastf1-session-v3"
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
