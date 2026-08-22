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
