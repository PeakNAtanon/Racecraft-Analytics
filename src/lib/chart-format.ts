export function toFiniteChartNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") {
    return null;
  }

  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatChartNumber(value: unknown, decimals = 1) {
  const number = toFiniteChartNumber(value);
  return number === null ? "—" : number.toFixed(decimals);
}

export function formatLapTooltipValue(value: unknown) {
  const number = toFiniteChartNumber(value);
  return number === null ? "—" : `${number.toFixed(3)} s`;
}

export function formatPositionTooltipValue(value: unknown) {
  const number = toFiniteChartNumber(value);
  return number === null ? "—" : `P${number}`;
}
