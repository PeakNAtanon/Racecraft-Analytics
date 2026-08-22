import { getCountryFlagCode } from "@/lib/country-flags";

export function CountryFlag({ country, className = "" }: { country: string; className?: string }) {
  const code = getCountryFlagCode(country);
  const classes = `country-flag ${className}`.trim();

  if (!code) {
    return <span className={`${classes} country-flag-fallback`} role="img" aria-label={`ธงชาติ${country}`}>{country.slice(0, 2).toUpperCase()}</span>;
  }

  return <span className={`${classes} fi fi-${code}`} role="img" aria-label={`ธงชาติ${country}`} />;
}
