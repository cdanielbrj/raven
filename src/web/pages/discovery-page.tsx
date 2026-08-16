import { useCallback, useEffect, useState, type FormEvent } from "react";
import { request } from "../api";
import { ErrorMessage } from "../components/media";
import { metadataLabel } from "../components/helpers/formatters";
import type { Entity, TrackedItem } from "../types";

export function DiscoveryPage({
  trackedIds,
  onTracked,
}: {
  trackedIds: Set<string>;
  onTracked: () => Promise<TrackedItem[]>;
}) {
  const [items, setItems] = useState<Entity[]>([]);
  const [mode, setMode] = useState<"current" | "next-season">("current");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);
  const load = useCallback(async (kind: string, value?: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = value
        ? `search=${encodeURIComponent(value)}`
        : `kind=${kind}`;
      const data = await request<{ items: Entity[] }>(
        `/api/v1/discovery/anime?${query}`,
      );
      setItems(data.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(mode);
  }, [load, mode]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (search.trim()) void load("search", search.trim());
  };
  const track = async (entity: Entity) => {
    setTracking(entity.externalId);
    setError(null);
    try {
      await request("/api/v1/tracking/anime", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ externalId: entity.externalId }),
      });
      await onTracked();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not track anime",
      );
    } finally {
      setTracking(null);
    }
  };
  return (
    <section className="page">
      <p className="eyebrow">ANIME</p>
      <h1>Find what to observe.</h1>
      <form className="search" onSubmit={submitSearch}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search anime"
          aria-label="Search anime"
        />
        <button>Search</button>
      </form>
      <div className="filters">
        {(["current", "next-season"] as const).map((item) => (
          <button
            key={item}
            className={mode === item ? "filter active" : "filter"}
            onClick={() => {
              setMode(item);
              setSearch("");
            }}
          >
            {item.replace("-", " ")}
          </button>
        ))}
      </div>
      {error && <ErrorMessage message={error} />}
      {loading ? (
        <p className="muted">Observing AniList…</p>
      ) : (
        <div className="discovery-grid motion-list">
          {items.map((entity) => (
            <article className="entity-card" key={entity.externalId}>
              <div className="cover">
                {entity.coverUrl ? (
                  <img src={entity.coverUrl} alt="" />
                ) : (
                  <span>NO COVER</span>
                )}
              </div>
              <div className="entity-copy">
                <span className="format-tag">{entity.format}</span>
                <h2>{entity.name}</h2>
                <p>{metadataLabel(entity)}</p>
              </div>
              <button
                className="track-button"
                disabled={
                  trackedIds.has(entity.externalId) ||
                  tracking === entity.externalId
                }
                onClick={() => void track(entity)}
              >
                {trackedIds.has(entity.externalId)
                  ? "Tracked"
                  : tracking === entity.externalId
                    ? "Tracking…"
                    : "Track"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
