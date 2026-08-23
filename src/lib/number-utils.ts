/**
 * Convert provider values to finite numbers without treating null as zero.
 * OpenF1 uses null for fields that do not apply, such as position for a DNF.
 */
export function finiteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
