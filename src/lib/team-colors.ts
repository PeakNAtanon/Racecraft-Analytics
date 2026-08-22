const teamPalette: Record<string, string> = {
  "mclaren": "#ff8700",
  "ferrari": "#e80020",
  "red bull": "#3671c6",
  "red bull racing": "#3671c6",
  "mercedes": "#27f4d2",
  "aston martin": "#229971",
  "alpine": "#0093cc",
  "alpine f1 team": "#0093cc",
  "williams": "#64c4ff",
  "haas": "#b6babd",
  "haas f1 team": "#b6babd",
  "rb": "#6692ff",
  "rb f1 team": "#6692ff",
  "racing bulls": "#6692ff",
  "sauber": "#52e252",
  "audi": "#f50537",
  "cadillac": "#f5f5f5",
  "cadillac f1 team": "#f5f5f5",
};

const teamMarks: Record<string, string> = {
  "mclaren": "McL",
  "ferrari": "FER",
  "red bull": "RBR",
  "red bull racing": "RBR",
  "mercedes": "MER",
  "aston martin": "AMR",
  "alpine": "ALP",
  "alpine f1 team": "ALP",
  "williams": "WIL",
  "haas": "HAA",
  "haas f1 team": "HAA",
  "rb": "RB",
  "rb f1 team": "RB",
  "racing bulls": "RB",
  "sauber": "SAU",
  "audi": "AUD",
  "cadillac": "CAD",
  "cadillac f1 team": "CAD",
};

function fallbackTeamMark(team: string | undefined) {
  const words = (team ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "TEAM";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
}

function validColor(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized}` : undefined;
}

export function getTeamColor(team: string | undefined, providerColor?: string) {
  return validColor(providerColor) ?? teamPalette[team?.trim().toLowerCase() ?? ""] ?? "#a6b0bf";
}

export function getTeamMark(team: string | undefined) {
  return teamMarks[team?.trim().toLowerCase() ?? ""] ?? fallbackTeamMark(team);
}
