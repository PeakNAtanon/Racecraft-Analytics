from racecraft_ingest.provider_roles import FASTF1_ANALYSIS_METRICS, provider_role


def test_provider_roles_keep_one_clear_owner_per_data_family():
    assert provider_role("Jolpica") == "race_championship"
    assert provider_role("OpenF1") == "session_context"
    assert provider_role("FastF1") == "analysis_engine"


def test_fastf1_owns_deep_analysis_metrics():
    assert "theoretical_best" in FASTF1_ANALYSIS_METRICS
    assert "tyre_degradation" in FASTF1_ANALYSIS_METRICS
    assert "teammate_comparison" in FASTF1_ANALYSIS_METRICS
