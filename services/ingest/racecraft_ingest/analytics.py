from __future__ import annotations
from statistics import median
from typing import Iterable

def clean_lap_median(lap_times: Iterable[float | None], excluded: Iterable[bool]) -> float | None:
    values = [float(value) for value, drop in zip(lap_times, excluded) if value is not None and not drop and value > 0]
    return median(values) if values else None

def degradation_slope(lap_numbers: Iterable[int], corrected_times: Iterable[float]) -> float | None:
    x, y = list(lap_numbers), list(corrected_times)
    if len(x) < 3 or len(x) != len(y): return None
    mean_x, mean_y = sum(x)/len(x), sum(y)/len(y)
    denominator = sum((value-mean_x)**2 for value in x)
    return sum((a-mean_x)*(b-mean_y) for a,b in zip(x,y))/denominator if denominator else None

def theoretical_best(sectors: Iterable[Iterable[float | None]]) -> float | None:
    columns = list(zip(*sectors))
    if not columns: return None
    best = [min(v for v in column if v is not None) for column in columns if any(v is not None for v in column)]
    return sum(best) if len(best) == len(columns) else None

def positions_gained(grid: int | None, finish: int | None, classified: bool = True) -> int | None:
    return grid - finish if classified and grid and finish else None
