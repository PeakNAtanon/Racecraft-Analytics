"""Download one published session and validate worker output in isolated storage.

Run with the ingest virtualenv and PYTHONPATH=services/ingest. This never runs
the worker loop, connects to PostgreSQL, or modifies production artifacts.
"""
import argparse
import json
import math
from pathlib import Path

import pyarrow.parquet as parquet

from racecraft_ingest.fastf1_adapter import FastF1Adapter


def invalid_json_number(value):
    raise ValueError(f"Invalid JSON number: {value}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--round", type=int, required=True)
    parser.add_argument("--session", choices=["FP1", "FP2", "FP3", "Q", "SQ", "S", "R"], required=True)
    parser.add_argument("--output", type=Path, required=True, help="New isolated directory; must not exist")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    adapter = FastF1Adapter(str(args.output / "cache"))
    session = adapter.load(args.season, args.round, args.session)
    assert int(session.event["RoundNumber"]) == args.round, "Provider returned the wrong round"
    destination = adapter.artifact_path(str(args.output / "artifacts"), args.season, args.round, args.session)
    adapter.export_session_artifact(session, str(destination), args.season, args.round, args.session)
    artifact = json.loads(destination.read_text(), parse_constant=invalid_json_number)
    assert artifact["status"] == "complete", "Worker did not complete"
    assert artifact["provider"] == "FastF1"
    assert (artifact["season"], artifact["round"], artifact["sessionCode"]) == (args.season, args.round, args.session)
    pace = artifact["pace"]
    assert pace["laps"] and pace["series"], "No validated pace; cannot verify chart path"
    for series in pace["series"]:
        assert len(series["values"]) == len(pace["laps"]), "Misaligned lap axis"
        assert all(value is None or (math.isfinite(value) and value > 0) for value in series["values"])
    telemetry = artifact["telemetryByDriver"]
    available = {code: trace for code, trace in telemetry.items() if trace.get("available")}
    assert available, "No real telemetry; cannot verify chart path"
    for code, trace in available.items():
        assert trace["samples"], f"{code}: empty telemetry"
        assert all(sample.get("timestamp") for sample in trace["samples"]), f"{code}: missing timestamps"
        assert trace["parquetPath"], f"{code}: Parquet was not written"
        assert parquet.read_metadata(trace["parquetPath"]).num_rows == trace["sampleCount"], f"{code}: Parquet row mismatch"
        if "distance" in trace["fields"]:
            source = parquet.read_table(trace["parquetPath"], columns=["Distance"])["Distance"].to_pylist()
            stride = max(1, trace["sampleCount"] // 600)
            assert [sample.get("distance") for sample in trace["samples"]] == source[::stride], f"{code}: Distance changed between Parquet and JSON"
    report = {
        "season": args.season, "round": args.round, "session": args.session,
        "event": str(session.event["EventName"]),
        "artifact": str(destination.resolve()), "schema": artifact["schemaVersion"],
        "paceDrivers": len(pace["series"]), "lapAxis": len(pace["laps"]),
        "telemetryDrivers": len(available),
        "missingTelemetry": sorted(set(artifact.get("driverAvailability", {})) - set(available)),
        "weather": artifact.get("weather"),
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
