function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function text(value: unknown) {
  return value === null || value === undefined ? "—" : String(value);
}

function lastMeaningfulValue(values: unknown[], predicate: (value: unknown) => boolean) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index])) return values[index];
  }
  return undefined;
}

function lapTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = (value - minutes * 60).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}

export function durationLabel(value: unknown): string {
  if (Array.isArray(value)) {
    const selected = lastMeaningfulValue(value, item => {
      const number = finiteNumber(item);
      return (number !== undefined && number > 0) || (typeof item === "string" && item.trim() !== "" && item !== "—");
    });
    return selected === undefined ? "—" : durationLabel(selected);
  }
  const number = finiteNumber(value);
  if (number === undefined) return text(value);
  if (number >= 3600) {
    const hours = Math.floor(number / 3600);
    const minutes = Math.floor(number % 3600 / 60);
    return `${hours}:${String(minutes).padStart(2, "0")}:${(number % 60).toFixed(3).padStart(6, "0")}`;
  }
  return lapTime(number);
}

export function gapLabel(value: unknown): string {
  if (Array.isArray(value)) {
    const numbers = value.map(finiteNumber).filter((number): number is number => number !== undefined);
    const nonZero = numbers.filter(number => number !== 0);
    if (nonZero.length) return gapLabel(nonZero[nonZero.length - 1]);
    const textValue = lastMeaningfulValue(value, item => typeof item === "string" && item.trim() !== "" && item !== "—");
    return textValue === undefined ? "LEADER" : gapLabel(textValue);
  }
  const number = finiteNumber(value);
  if (number === undefined) return text(value);
  return number === 0 ? "LEADER" : `+${number.toFixed(3)} s`;
}
