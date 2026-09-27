export const footballCountriesStorageKey = "raven.football.selectedCountries";

export function readSelectedFootballCountries(): string[] {
  try {
    const value = window.localStorage.getItem(footballCountriesStorageKey);
    const countries = value ? JSON.parse(value) : [];
    return Array.isArray(countries) &&
      countries.every((item) => typeof item === "string")
      ? countries
      : [];
  } catch {
    return [];
  }
}

export function writeSelectedFootballCountries(countries: string[]): void {
  window.localStorage.setItem(
    footballCountriesStorageKey,
    JSON.stringify(countries),
  );
}
