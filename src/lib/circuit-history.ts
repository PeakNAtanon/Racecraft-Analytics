export interface CircuitHistorySeed {
  firstGrandPrix: number;
  firstRaceName?: string;
  seasonDebut?: boolean;
}

// Reference coverage for the 2026 calendar. Jolpica data overrides these values
// when a provider record is available; the seeds keep every circuit card useful
// when a new venue has no historical F1 result yet.
export const circuitHistorySeeds: Record<string, CircuitHistorySeed> = {
  "albert-park": { firstGrandPrix: 1996, firstRaceName: "Australian Grand Prix" },
  shanghai: { firstGrandPrix: 2004, firstRaceName: "Chinese Grand Prix" },
  suzuka: { firstGrandPrix: 1987, firstRaceName: "Japanese Grand Prix" },
  miami: { firstGrandPrix: 2022, firstRaceName: "Miami Grand Prix" },
  villeneuve: { firstGrandPrix: 1978, firstRaceName: "Canadian Grand Prix" },
  monaco: { firstGrandPrix: 1950, firstRaceName: "Monaco Grand Prix" },
  catalunya: { firstGrandPrix: 1991, firstRaceName: "Spanish Grand Prix" },
  "red-bull-ring": { firstGrandPrix: 1970, firstRaceName: "Austrian Grand Prix" },
  silverstone: { firstGrandPrix: 1950, firstRaceName: "British Grand Prix" },
  spa: { firstGrandPrix: 1950, firstRaceName: "Belgian Grand Prix" },
  hungaroring: { firstGrandPrix: 1986, firstRaceName: "Hungarian Grand Prix" },
  zandvoort: { firstGrandPrix: 1952, firstRaceName: "Dutch Grand Prix" },
  monza: { firstGrandPrix: 1950, firstRaceName: "Italian Grand Prix" },
  madring: { firstGrandPrix: 2026, firstRaceName: "Spanish Grand Prix", seasonDebut: true },
  baku: { firstGrandPrix: 2016, firstRaceName: "European Grand Prix" },
  sepang: { firstGrandPrix: 1999, firstRaceName: "Malaysian Grand Prix" },
  "marina-bay": { firstGrandPrix: 2008, firstRaceName: "Singapore Grand Prix" },
  americas: { firstGrandPrix: 2012, firstRaceName: "United States Grand Prix" },
  rodriguez: { firstGrandPrix: 1963, firstRaceName: "Mexican Grand Prix" },
  interlagos: { firstGrandPrix: 1973, firstRaceName: "Brazilian Grand Prix" },
  vegas: { firstGrandPrix: 1981, firstRaceName: "Caesars Palace Grand Prix" },
  losail: { firstGrandPrix: 2021, firstRaceName: "Qatar Grand Prix" },
  "yas-marina": { firstGrandPrix: 2009, firstRaceName: "Abu Dhabi Grand Prix" },
};

export function circuitHistorySeed(slug: string) {
  return circuitHistorySeeds[slug];
}
