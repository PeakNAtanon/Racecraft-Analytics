from racecraft_ingest.analytics import clean_lap_median, degradation_slope, positions_gained, theoretical_best

def test_clean_laps_exclude_safety_car_and_missing(): assert clean_lap_median([80.0, None, 110.0, 82.0],[False,False,True,False]) == 81.0
def test_wet_short_stint_returns_no_slope(): assert degradation_slope([1,2],[91.0,92.0]) is None
def test_degradation_slope(): assert round(degradation_slope([1,2,3,4],[80.0,80.1,80.2,80.3]) or 0,3) == .1
def test_theoretical_best(): assert theoretical_best([[20.1,31.0,25.0],[20.0,31.2,24.8]]) == 75.8
def test_dnf_has_no_positions_gained(): assert positions_gained(3,18,classified=False) is None
