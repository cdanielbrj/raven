import { useEffect, useMemo, useState } from "react";
import { request } from "../../../api";
import { ErrorMessage } from "../../../themes/raven/components/error-message/error-message";
import {
  readSelectedFootballCountries,
  writeSelectedFootballCountries,
} from "./football-preferences";
import "./countries-view.css";

interface FootballCountry {
  id: string;
  name: string;
  leagueCount: number;
  flagUrl: string | null;
}

export function CountriesView() {
  const [countries, setCountries] = useState<FootballCountry[]>([]);
  const [selected, setSelected] = useState<string[]>(
    readSelectedFootballCountries,
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    void request<{ items: FootballCountry[] }>(
      "/api/v1/sports/football/countries",
    )
      .then((data) => setCountries(data.items))
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Could not load countries",
        ),
      );
  }, []);

  const selectedCountries = selected
    .map((id) => countries.find((country) => country.id === id))
    .filter((country): country is FootballCountry => Boolean(country));
  const availableCountries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return countries.filter(
      (country) =>
        !selected.includes(country.id) &&
        (!query || country.name.toLocaleLowerCase().includes(query)),
    );
  }, [countries, search, selected]);

  const addCountry = async (country: FootballCountry) => {
    setAdding(country.id);
    setError(null);
    try {
      const result = await request<{ items: unknown[] }>(
        `/api/v1/sports/football/countries/${encodeURIComponent(country.id)}/leagues`,
      );
      if (result.items.length === 0) {
        setError(`${country.name} has no football leagues available.`);
        return;
      }
      const next = [...selected, country.id];
      setSelected(next);
      writeSelectedFootballCountries(next);
      setSearch("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not check country",
      );
    } finally {
      setAdding(null);
    }
  };

  const removeCountry = (countryId: string) => {
    const next = selected.filter((id) => id !== countryId);
    setSelected(next);
    writeSelectedFootballCountries(next);
  };

  return (
    <section className="page football-countries-page theme-sports">
      <p className="eyebrow">Football</p>
      <h1>Choose your football countries.</h1>
      <p className="teams-intro">
        Select countries first. Their leagues will become available as team
        tabs.
      </p>
      {error && <ErrorMessage message={error} />}
      <section className="selected-countries" aria-labelledby="selected-title">
        <div className="selected-countries-heading">
          <h2 id="selected-title">Selected</h2>
          <span>{selectedCountries.length}</span>
        </div>
        {selectedCountries.length === 0 ? (
          <p className="muted">No countries selected yet.</p>
        ) : (
          <div className="selected-country-list">
            {selectedCountries.map((country) => (
              <div className="selected-country" key={country.id}>
                {country.flagUrl ? (
                  <img alt="" src={country.flagUrl} />
                ) : (
                  <span className="country-flag-fallback" aria-hidden="true">
                    ●
                  </span>
                )}
                <span>{country.name}</span>
                <button
                  aria-label={`Remove ${country.name}`}
                  onClick={() => removeCountry(country.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <label className="country-dropdown">
        <span>Add a country</span>
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search any country"
          type="search"
          value={search}
        />
      </label>
      {search && (
        <div className="country-results" role="listbox" aria-label="Countries">
          {availableCountries.slice(0, 12).map((country) => (
            <button
              className="country-result"
              key={country.id}
              disabled={adding === country.id}
              onClick={() => void addCountry(country)}
              type="button"
            >
              {country.flagUrl ? (
                <img alt="" src={country.flagUrl} />
              ) : (
                <span />
              )}
              <strong>{country.name}</strong>
            </button>
          ))}
          {availableCountries.length === 0 && (
            <p className="muted">No matching countries.</p>
          )}
        </div>
      )}
    </section>
  );
}
