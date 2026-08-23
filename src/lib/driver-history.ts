export interface DriverHistorySeed {
  driverId: string;
  driverNumber: number;
  nationality: string;
  dateOfBirth: string;
  firstF1Season: number;
}

// Stable identity fields keep the standings useful while a provider snapshot is unavailable.
// Live values from Jolpica take precedence in the data layer.
export const driverHistorySeeds: Record<string, DriverHistorySeed> = {
  ANT: { driverId: "antonelli", driverNumber: 12, nationality: "Italian", dateOfBirth: "2006-08-25", firstF1Season: 2025 },
  HAM: { driverId: "hamilton", driverNumber: 44, nationality: "British", dateOfBirth: "1985-01-07", firstF1Season: 2007 },
  RUS: { driverId: "russell", driverNumber: 63, nationality: "British", dateOfBirth: "1998-02-15", firstF1Season: 2019 },
  LEC: { driverId: "leclerc", driverNumber: 16, nationality: "Monegasque", dateOfBirth: "1997-10-16", firstF1Season: 2018 },
  NOR: { driverId: "norris", driverNumber: 1, nationality: "British", dateOfBirth: "1999-11-13", firstF1Season: 2019 },
  VER: { driverId: "max_verstappen", driverNumber: 3, nationality: "Dutch", dateOfBirth: "1997-09-30", firstF1Season: 2015 },
  PIA: { driverId: "piastri", driverNumber: 81, nationality: "Australian", dateOfBirth: "2001-04-06", firstF1Season: 2023 },
  HAD: { driverId: "hadjar", driverNumber: 6, nationality: "French", dateOfBirth: "2004-09-28", firstF1Season: 2025 },
  LAW: { driverId: "lawson", driverNumber: 30, nationality: "New Zealander", dateOfBirth: "2002-02-11", firstF1Season: 2023 },
  GAS: { driverId: "gasly", driverNumber: 10, nationality: "French", dateOfBirth: "1996-02-07", firstF1Season: 2017 },
  LIN: { driverId: "arvid_lindblad", driverNumber: 41, nationality: "British", dateOfBirth: "2007-08-08", firstF1Season: 2026 },
  COL: { driverId: "colapinto", driverNumber: 43, nationality: "Argentine", dateOfBirth: "2003-05-27", firstF1Season: 2024 },
  BEA: { driverId: "bearman", driverNumber: 87, nationality: "British", dateOfBirth: "2005-05-08", firstF1Season: 2025 },
  BOR: { driverId: "bortoleto", driverNumber: 5, nationality: "Brazilian", dateOfBirth: "2004-10-14", firstF1Season: 2025 },
  SAI: { driverId: "sainz", driverNumber: 55, nationality: "Spanish", dateOfBirth: "1994-09-01", firstF1Season: 2015 },
  ALB: { driverId: "albon", driverNumber: 23, nationality: "Thai", dateOfBirth: "1996-03-23", firstF1Season: 2019 },
  OCO: { driverId: "ocon", driverNumber: 31, nationality: "French", dateOfBirth: "1996-09-17", firstF1Season: 2016 },
  HUL: { driverId: "hulkenberg", driverNumber: 27, nationality: "German", dateOfBirth: "1987-08-19", firstF1Season: 2010 },
  ALO: { driverId: "alonso", driverNumber: 14, nationality: "Spanish", dateOfBirth: "1981-07-29", firstF1Season: 2001 },
  STR: { driverId: "stroll", driverNumber: 18, nationality: "Canadian", dateOfBirth: "1998-10-29", firstF1Season: 2017 },
  BOT: { driverId: "bottas", driverNumber: 77, nationality: "Finnish", dateOfBirth: "1989-08-28", firstF1Season: 2013 },
  PER: { driverId: "perez", driverNumber: 11, nationality: "Mexican", dateOfBirth: "1990-01-26", firstF1Season: 2011 },
};
