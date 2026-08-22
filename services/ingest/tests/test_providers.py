from racecraft_ingest.providers import canonical_session_code

def test_canonical_session_code_handles_provider_aliases():
    assert canonical_session_code("Practice 1") == "FP1"
    assert canonical_session_code("Sprint Shootout") == "SQ"
    assert canonical_session_code("Race") == "R"

def test_canonical_session_code_rejects_non_session_rows():
    assert canonical_session_code("Day 1") is None
