import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../../../api";
import { LeagueTabs } from "../../../themes/sports/components/league-tabs/league-tabs";
import { TeamCard } from "../../../themes/sports/components/team-card/team-card";
import { ErrorMessage } from "../../../themes/raven/components/error-message/error-message";
import type { DiscoveryResponse, Entity, TrackedItem } from "../../../types";
import "./teams-view.css";

const leagues = [{ id: "nba", label: "NBA" }];

export function TeamsView({
  trackedIds,
  onTracked,
}: {
  trackedIds: Set<string>;
  onTracked: () => Promise<TrackedItem[]>;
}) {
  const [teams, setTeams] = useState<Entity[]>([]);
  const [activeLeague, setActiveLeague] = useState("nba");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [assetsSyncing, setAssetsSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<DiscoveryResponse>("/api/v1/sports/nba/teams");
      setTeams(data.items);
      setAssetsSyncing(data.meta.assets?.status === "syncing");
      setCatalogNotice(
        data.meta.stale
          ? "The NBA catalog is temporarily unavailable. Showing the latest local roster."
          : null,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load teams",
      );
    } finally {
      setLoading(false);
    }
  }, []);

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
      await request(`/api/v1/sports/nba/teams/${team.externalId}/follow`, {
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
      <p className="eyebrow">NBA</p>
      <h1>Choose the teams you follow.</h1>
      <p className="teams-intro">
        Follow a team once. Its games will join your upcoming events as the
        schedule is synchronized.
      </p>
      <LeagueTabs
        activeLeague={activeLeague}
        leagues={leagues}
        onChange={setActiveLeague}
      />
      <label className="team-search">
        <span>Search NBA teams</span>
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Boston Celtics"
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
      {loading ? (
        <p className="muted">Loading NBA teams…</p>
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
