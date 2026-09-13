// Keep the temporary web view focused on the active season even when the
// deployment has not yet provided an explicit WEB_SEASONS setting.
const DEFAULT_WEB_SEASONS = [2026];

function parseSeasons(value: string | undefined) {
  if (value === undefined) return DEFAULT_WEB_SEASONS;
  const seasons = value.split(",").map(item => Number(item.trim())).filter(year => Number.isInteger(year) && year > 0);
  return Array.from(new Set(seasons)).sort((left, right) => right - left);
}

export function getWebSeasons() {
  const seasons = parseSeasons(process.env.WEB_SEASONS);
  return seasons.length ? seasons : [Number(process.env.F1_SEASON ?? "2026")];
}

export function isWebSeasonVisible(season: number) {
  return getWebSeasons().includes(season);
}

export function resolveWebSeason(value: unknown) {
  const seasons = getWebSeasons();
  const requested = Number(value);
  return Number.isInteger(requested) && seasons.includes(requested) ? requested : seasons[0] ?? 2026;
}
