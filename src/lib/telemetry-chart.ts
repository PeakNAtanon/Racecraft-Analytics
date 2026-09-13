import type { DriverTelemetryPoint } from "./types";

/** Keep FastF1's distance origin and spacing. Reject incomplete traces instead
 * of joining across missing distance samples or deriving distance from speed. */
export function distanceTelemetry(samples: DriverTelemetryPoint[]): Array<DriverTelemetryPoint & { distance: number }> {
  if (samples.length < 2) return [];
  let previous = Number.NEGATIVE_INFINITY;
  for (const sample of samples) {
    if (typeof sample.distance !== "number" || !Number.isFinite(sample.distance) || sample.distance < previous) return [];
    previous = sample.distance;
  }
  if (samples.at(-1)!.distance! <= samples[0].distance!) return [];
  return samples as Array<DriverTelemetryPoint & { distance: number }>;
}

function sampleTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const duration = value.match(/^(?:(\d+) days? )?(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (duration) return ((Number(duration[1] ?? 0) * 24 + Number(duration[2])) * 3600 + Number(duration[3]) * 60 + Number(duration[4])) * 1000;
  const normalized = value.replace(" ", "T");
  const parsed = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function elapsedTelemetry(samples: DriverTelemetryPoint[]) {
  const times = samples.map(sample => sampleTime(sample.timestamp));
  const origin = times.find(time => time !== undefined);
  let previous = Number.NEGATIVE_INFINITY;
  return samples.flatMap((sample, index) => {
    const time = times[index];
    if (origin === undefined || time === undefined || time < previous) return [];
    previous = time;
    return [{ ...sample, elapsed: (time - origin) / 1000 }];
  });
}
