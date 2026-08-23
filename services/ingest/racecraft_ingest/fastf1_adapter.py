from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from statistics import median, pstdev
from typing import Any

from .analytics import degradation_slope, theoretical_best


FASTF1_ARTIFACT_SCHEMA_VERSION = "fastf1-session-v3"


def _records(frame: Any) -> list[dict[str, Any]]:
    if frame is None:
        return []
    if hasattr(frame, "to_dict"):
        return list(frame.to_dict("records"))
    return [dict(row) for row in frame]


def _missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        result = value != value
        return bool(result) if isinstance(result, bool) else False
    except (TypeError, ValueError):
        return False


def _seconds(value: Any) -> float | None:
    if _missing(value):
        return None
    if hasattr(value, "total_seconds"):
        return float(value.total_seconds())
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _number(value: Any) -> float | int | None:
    parsed = _seconds(value)
    if parsed is None:
        return None
    return int(parsed) if parsed.is_integer() else parsed


def _text(value: Any, default: str = "") -> str:
    return default if _missing(value) else str(value)


def _truthy(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _boolean(value: Any) -> bool | None:
    if _missing(value):
        return None
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y"}:
        return True
    if normalized in {"0", "false", "no", "n"}:
        return False
    return None


def _weather_snapshot(session: Any) -> dict[str, Any] | None:
    rows = _records(getattr(session, "weather_data", None))
    if not rows:
        return None

    latest = rows[-1]
    latest_data: dict[str, Any] = {}
    timestamp = latest.get("Time") or latest.get("Date")
    if not _missing(timestamp):
        latest_data["timestamp"] = str(timestamp)

    field_map = {
        "AirTemp": "airTemperature",
        "TrackTemp": "trackTemperature",
        "Humidity": "humidity",
        "WindSpeed": "windSpeed",
        "WindDirection": "windDirection",
    }
    for source, target in field_map.items():
        value = _number(latest.get(source))
        if value is not None:
            latest_data[target] = value

    rainfall = _boolean(latest.get("Rainfall"))
    if rainfall is not None:
        latest_data["rainfall"] = rainfall

    return {"sampleCount": len(rows), "latest": latest_data}


def _clean_lap(row: Mapping[str, Any]) -> tuple[int, float] | None:
    lap_number = _number(row.get("LapNumber"))
    lap_time = _seconds(row.get("LapTime"))
    if not isinstance(lap_number, (int, float)) or lap_time is None or lap_time <= 0:
        return None
    if _truthy(row.get("Deleted")) or (not _missing(row.get("IsAccurate")) and not _truthy(row.get("IsAccurate"))):
        return None
    if not _missing(row.get("PitInTime")) or not _missing(row.get("PitOutTime")):
        return None
    track_status = _text(row.get("TrackStatus"), "1")
    if track_status and track_status != "1":
        return None
    return int(lap_number), lap_time


def _driver_code(row: Mapping[str, Any]) -> str:
    return _text(row.get("Driver") or row.get("Abbreviation") or row.get("DriverNumber"), "UNKNOWN").upper()


def _telemetry_snapshot(session: Any, driver: str, output_dir: Path) -> dict[str, Any] | None:
    try:
        fastest = session.laps.pick_drivers(driver).pick_fastest()
        if fastest is None or getattr(fastest, "empty", False):
            return None
        telemetry = fastest.get_telemetry()
        rows = _records(telemetry)
    except (AttributeError, IndexError, KeyError, TypeError, ValueError):
        return None
    if not rows:
        return None

    field_map = {"Speed": "speed", "Throttle": "throttle", "Brake": "brake", "nGear": "gear"}
    fields = [target for source, target in field_map.items() if any(not _missing(row.get(source)) for row in rows)]
    samples: list[dict[str, Any]] = []
    for row in rows:
        sample: dict[str, Any] = {}
        date = row.get("Date") or row.get("Time")
        if not _missing(date):
            sample["timestamp"] = str(date)
        for source, target in field_map.items():
            value = _number(row.get(source))
            if value is not None:
                sample[target] = value
        if len(sample) > 1:
            samples.append(sample)
    if not samples or not fields:
        return None

    stride = max(1, len(samples) // 600)
    parquet_path = output_dir / f"driver-{driver.lower()}.parquet"
    try:
        telemetry.to_parquet(parquet_path, compression="zstd", index=False)
    except (AttributeError, OSError, TypeError, ValueError):
        parquet_path = None
    return {
        "driver": driver,
        "available": True,
        "sampleCount": len(samples),
        "fields": fields,
        "samples": samples[::stride],
        "parquetPath": str(parquet_path) if parquet_path else None,
    }


class FastF1Adapter:
    """FastF1-backed analysis engine used after a session is published.

    Jolpica and OpenF1 decide whether a session/result exists. This adapter is
    deliberately the only place that creates deep pace, tyre and telemetry
    artifacts, so the web layer never imports FastF1 or downloads raw data.
    """

    def __init__(self, cache_dir: str):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def artifact_path(self, storage_dir: str, season: int, round_number: int, session_code: str) -> Path:
        path = Path(storage_dir) / str(season) / str(round_number) / session_code.upper()
        path.mkdir(parents=True, exist_ok=True)
        return path / "session.json"

    def load(self, season: int, round_number: int, session_code: str):
        import fastf1

        fastf1.Cache.enable_cache(str(self.cache_dir))
        session = fastf1.get_session(season, round_number, session_code)
        session.load(laps=True, telemetry=True, weather=True, messages=True)
        return session

    def export_driver_telemetry(self, session, driver: str, destination: str) -> int:
        lap = session.laps.pick_drivers(driver).pick_fastest()
        telemetry = lap.get_telemetry()
        telemetry.to_parquet(destination, compression="zstd", index=False)
        return len(telemetry)

    def export_session_artifact(self, session: Any, destination: str, season: int, round_number: int, session_code: str) -> dict[str, Any]:
        target = Path(destination)
        target.parent.mkdir(parents=True, exist_ok=True)
        telemetry_dir = target.parent / "telemetry"
        telemetry_dir.mkdir(parents=True, exist_ok=True)
        lap_rows = _records(getattr(session, "laps", None))
        drivers: dict[str, list[dict[str, Any]]] = {}
        for row in lap_rows:
            drivers.setdefault(_driver_code(row), []).append(row)

        metric_rows: list[dict[str, Any]] = []
        pace_series: list[dict[str, Any]] = []
        stints: list[dict[str, Any]] = []
        racecraft_by_driver: dict[str, dict[str, Any]] = {}
        telemetry_by_driver: dict[str, dict[str, Any]] = {}
        cleaned_by_driver: dict[str, list[tuple[int, float]]] = {}
        for driver, rows in drivers.items():
            cleaned_by_driver[driver] = [sample for row in rows if (sample := _clean_lap(row)) is not None]
        # Do not put a lap on the chart when no driver has a validated value
        # for it. This removes empty x-axis slots while preserving null gaps
        # for a driver whose own lap was rejected by FastF1 validation.
        lap_numbers = sorted({lap for clean in cleaned_by_driver.values() for lap, _ in clean})

        for driver, rows in sorted(drivers.items()):
            clean = cleaned_by_driver[driver]
            times = [value for _, value in clean]
            if not times:
                continue
            laps_by_number = {lap: value for lap, value in clean}
            sectors = [
                [_seconds(row.get(column)) for column in ("Sector1Time", "Sector2Time", "Sector3Time")]
                for row in rows
            ]
            sectors = [[value for value in row if value is not None] for row in sectors]
            sector_matrix = [row for row in sectors if len(row) == 3]
            theoretical = theoretical_best(sector_matrix)
            degradation = degradation_slope([lap for lap, _ in clean], times)
            metric_rows.append({
                "driver": driver,
                "validLaps": len(times),
                "cleanLapMedian": median(times),
                "bestLap": min(times),
                "consistency": pstdev(times) if len(times) > 1 else None,
                "degradationSlope": degradation,
                "theoreticalBest": theoretical,
            })
            pace_series.append({
                "code": driver,
                "name": driver,
                "values": [laps_by_number.get(lap) for lap in lap_numbers],
            })

            stint_groups: dict[tuple[Any, str], list[int]] = {}
            for row in rows:
                lap = _number(row.get("LapNumber"))
                stint = row.get("Stint")
                if lap is None:
                    continue
                key = (stint, _text(row.get("Compound"), "UNKNOWN"))
                stint_groups.setdefault(key, []).append(int(lap))
            for index, ((stint, compound), laps) in enumerate(sorted(stint_groups.items(), key=lambda item: min(item[1])) or [], 1):
                stints.append({"driver": driver, "stint": _number(stint) or index, "compound": compound, "startLap": min(laps), "endLap": max(laps), "lapCount": len(laps)})

            telemetry = _telemetry_snapshot(session, driver, telemetry_dir)
            if telemetry:
                telemetry_by_driver[driver] = telemetry

        for row in _records(getattr(session, "results", None)):
            driver = _driver_code(row)
            finish = _number(row.get("Position"))
            grid = _number(row.get("GridPosition"))
            if grid is None:
                grid = _number(row.get("Grid"))
            if not driver or finish is None:
                continue
            racecraft_by_driver[driver] = {
                "finishPosition": finish,
                **({"gridPosition": grid, "positionsGained": grid - finish} if grid is not None else {}),
            }

        artifact = {
            "provider": "FastF1",
            "schemaVersion": FASTF1_ARTIFACT_SCHEMA_VERSION,
            "status": "complete",
            "season": season,
            "round": round_number,
            "sessionCode": session_code.upper(),
            "sessionName": _text(getattr(session, "name", None), session_code.upper()),
            "metrics": metric_rows,
            "pace": {"laps": lap_numbers, "series": pace_series},
            "stints": stints,
            "racecraftByDriver": racecraft_by_driver,
            "telemetryByDriver": telemetry_by_driver,
            "dataQuality": {
                "driversSeen": len(drivers),
                "driversWithValidLaps": len(metric_rows),
                "validLaps": sum(int(item.get("validLaps", 0)) for item in metric_rows),
                "telemetryDrivers": len(telemetry_by_driver),
                "telemetrySamples": sum(int(item.get("sampleCount", 0)) for item in telemetry_by_driver.values()),
                "stints": len(stints),
            },
        }
        weather = _weather_snapshot(session)
        if weather:
            artifact["weather"] = weather
        target.write_text(json.dumps(artifact, ensure_ascii=False, default=str), encoding="utf-8")
        return artifact
