import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../../../api";
import { LeagueTabs } from "../../../themes/sports/components/league-tabs/league-tabs";
import { TeamCard } from "../../../themes/sports/components/team-card/team-card";
import { ErrorMessage } from "../../../themes/raven/components/error-message/error-message";
import type { DiscoveryResponse, Entity, TrackedItem } from "../../../types";
import { readSelectedFootballCountries } from "../football/football-preferences";
import "./teams-view.css";

type SportsKind = "nba" | "football";

const configBySport = {
  nba: {
    label: "NBA",
    endpoint: "/api/v1/sports/nba/teams",
    followEndpoint: (externalId: string) =>
      `/api/v1/sports/nba/teams/${externalId}/follow`,
    searchLabel: "Search NBA teams",
    placeholder: "Boston Celtics",
    loadingLabel: "Loading NBA teams…",
    staleNotice:
      "The NBA catalog is temporarily unavailable. Showing the latest local roster.",
  },
  football: {
    label: "Football",
    endpoint: "/api/v1/sports/football/teams",
    followEndpoint: (externalId: string) =>
      `/api/v1/sports/football/teams/${externalId}/follow`,
    searchLabel: "Search football teams",
    placeholder: "Flamengo",
    loadingLabel: "Loading football teams…",
    staleNotice: null,
  },
} as const;

export function TeamsView({
  trackedIds,
  onTracked,
  sport = "nba",
}: {
  trackedIds: Set<string>;
  onTracked: () => Promise<TrackedItem[]>;
  sport?: SportsKind;
}) {
  const config = configBySport[sport];
  const [teams, setTeams] = useState<Entity[]>([]);
  const [activeLeague, setActiveLeague] = useState(sport);
  const [selectedCountries] = useState<string[]>(
    sport === "football" ? readSelectedFootballCountries : [],
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [assetsSyncing, setAssetsSyncing] = useState(false);

  const activeCountry = selectedCountries.includes(activeLeague)
    ? activeLeague
    : selectedCountries[0];

  const load = useCallback(async () => {
    if (sport === "football" && !activeCountry) {
      setTeams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query =
        sport === "football"
          ? `?countries=${encodeURIComponent(activeCountry)}`
          : "";
      const data = await request<DiscoveryResponse>(
        `${config.endpoint}${query}`,
      );
      setTeams(data.items);
      setAssetsSyncing(data.meta.assets?.status === "syncing");
      setCatalogNotice(data.meta.stale ? config.staleNotice : null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load teams",
      );
    } finally {
      setLoading(false);
    }
  }, [activeCountry, config, sport]);

  useEffect(() => {
    void load();
  }, [load, activeLeague]);

  useEffect(() => {
    if (!assetsSyncing) return;
    const interval = window.setInterval(() => void load(), 5_000);
    return () => window.clearInterval(interval);
  }, [assetsSyncing, load]);

  const visibleTeams = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return teams;
    return teams.filter((team) =>
      `${team.name} ${team.metadata?.abbreviation ?? ""}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [search, teams]);

  const follow = async (team: Entity) => {
    setTracking(team.externalId);
    setError(null);
    try {
      await request(config.followEndpoint(team.externalId), {
        method: "POST",
      });
      await onTracked();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not follow team",
      );
    } finally {
      setTracking(null);
    }
  };

  return (
    <section className="page teams-page theme-sports">
      <p className="eyebrow">{config.label}</p>
      <h1>Choose the teams you follow.</h1>
      <p className="teams-intro">
        Follow a team once. Its games will join your upcoming events as the
        schedule is synchronized.
      </p>
      {sport === "football" && selectedCountries.length > 0 && (
        <LeagueTabs
          activeLeague={activeCountry ?? ""}
          leagues={selectedCountries.map((country) => ({
            id: country,
            label: country,
          }))}
          onChange={setActiveLeague}
        />
      )}
      <label className="team-search">
        <span>{config.searchLabel}</span>
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder={config.placeholder}
          type="search"
          value={search}
        />
      </label>
      {error && <ErrorMessage message={error} />}
      {catalogNotice && <p className="catalog-notice">{catalogNotice}</p>}
      {assetsSyncing && (
        <p className="team-assets-status">
          Loading the local team crest cache…
        </p>
      )}
      {sport === "football" && selectedCountries.length === 0 ? (
        <p className="muted">Select at least one country to browse teams.</p>
      ) : loading ? (
        <p className="muted">{config.loadingLabel}</p>
      ) : (
        <div className="teams-grid motion-list">
          {visibleTeams.map((team) => (
            <TeamCard
              entity={team}
              key={team.externalId}
              onTrack={(entity) => void follow(entity)}
              tracked={trackedIds.has(team.externalId)}
              tracking={tracking === team.externalId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
