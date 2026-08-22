from __future__ import annotations

from typing import Final, Literal

ProviderRole = Literal["race_championship", "session_context", "analysis_engine"]

PROVIDER_ROLES: Final[dict[str, ProviderRole]] = {
    "jolpica": "race_championship",
    "openf1": "session_context",
    "fastf1": "analysis_engine",
}

FASTF1_ANALYSIS_METRICS: Final[tuple[str, ...]] = (
    "fastest_lap_telemetry",
    "sector_delta",
    "theoretical_best",
    "clean_lap_pace",
    "tyre_degradation",
    "stint_performance",
    "driver_comparison",
    "teammate_comparison",
    "track_position",
    "consistency",
    "pace_trend",
)


def provider_role(provider: str) -> ProviderRole | None:
    return PROVIDER_ROLES.get(provider.strip().lower())

