/**
 * Produces one dashed bridge for each uninterrupted gap between two known
 * classified positions. Each bridge retains the category indexes so a chart
 * can indicate missing data without pretending that it is a race result.
 */
export function buildPositionGapBridges(values: Array<number | null>): Array<Array<number | null>> {
  const bridges: Array<Array<number | null>> = [];
  let previousKnownIndex: number | undefined;

  values.forEach((value, index) => {
    if (value === null) return;
    if (previousKnownIndex !== undefined && index - previousKnownIndex > 1) {
      const bridge = Array<number | null>(values.length).fill(null);
      bridge[previousKnownIndex] = values[previousKnownIndex];
      bridge[index] = value;
      bridges.push(bridge);
    }
    previousKnownIndex = index;
  });

  return bridges;
}

/**
 * Produces dashed bridges for a numeric chart when a value is missing between
 * two validated samples. The bridge is visual context only; the source series
 * remains null so tooltips and tables never present an invented value.
 */
export function buildValueGapBridges(values: Array<number | null | undefined>): Array<Array<number | null>> {
  const bridges: Array<Array<number | null>> = [];
  let previousKnownIndex: number | undefined;

  values.forEach((value, index) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    if (previousKnownIndex !== undefined && index - previousKnownIndex > 1) {
      const bridge = Array<number | null>(values.length).fill(null);
      const previousValue = values[previousKnownIndex];
      if (typeof previousValue === "number" && Number.isFinite(previousValue)) {
        bridge[previousKnownIndex] = previousValue;
        bridge[index] = value;
        bridges.push(bridge);
      }
    }
    previousKnownIndex = index;
  });

  return bridges;
}
