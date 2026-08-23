import { useCallback, useEffect, useState, type FormEvent } from "react";
import { request } from "../../api";
import { DefaultCard } from "../../components/card-default/card-default";
import { DiscoveryControls } from "../../components/discovery-controls/discovery-controls";
import { ErrorMessage } from "../../states/error-message/error-message";
import type { Entity, TrackedItem } from "../../types";
import "./discovery-view.css";

export function DiscoveryView({
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
      <DiscoveryControls
        mode={mode}
        search={search}
        onSearchChange={setSearch}
        onSubmit={submitSearch}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          setSearch("");
        }}
      />
      {error && <ErrorMessage message={error} />}
      {loading ? (
        <p className="muted">Observing AniList…</p>
      ) : (
        <div className="discovery-grid motion-list">
          {items.map((entity) => (
            <DefaultCard
              entity={entity}
              tracked={trackedIds.has(entity.externalId)}
              tracking={tracking === entity.externalId}
              onTrack={(trackedEntity) => void track(trackedEntity)}
              key={entity.externalId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
