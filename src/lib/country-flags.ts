const countryCodes: Record<string, string> = {
  australia: "au",
  austria: "at",
  azerbaijan: "az",
  bahrain: "bh",
  belgium: "be",
  brazil: "br",
  canada: "ca",
  china: "cn",
  france: "fr",
  germany: "de",
  hungary: "hu",
  india: "in",
  italy: "it",
  japan: "jp",
  malaysia: "my",
  mexico: "mx",
  monaco: "mc",
  netherlands: "nl",
  portugal: "pt",
  qatar: "qa",
  russia: "ru",
  singapore: "sg",
  "south africa": "za",
  spain: "es",
  thailand: "th",
  turkey: "tr",
  "united arab emirates": "ae",
  "united kingdom": "gb",
  "united states": "us",
  "united states of america": "us",
  uae: "ae",
  uk: "gb",
  usa: "us",
  vietnam: "vn",
  "saudi arabia": "sa",
};

function normalizeCountry(country: string) {
  return country.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getCountryFlagCode(country: string) {
  return countryCodes[normalizeCountry(country)];
}
