import { useCallback, useEffect, useState } from "react";
import { request } from "../../../api";
import { TeamCard } from "../../../themes/sports/components/team-card/team-card";
import { EmptyState } from "../../../themes/raven/components/empty-state/empty-state";
import { ErrorMessage } from "../../../themes/raven/components/error-message/error-message";
import type { TrackedItem } from "../../../types";
import "./teams-tracking-view.css";

export function TeamsTrackingView({
  onChanged,
}: {
  onChanged: () => Promise<unknown>;
}) {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await request<{ items: TrackedItem[] }>(
        "/api/v1/sports/nba/tracking",
      );
      setItems(data.items);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load teams",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const untrack = async (item: TrackedItem) => {
    if (!item.entity.id) return;
    setRemoving(item.entity.id);
    setError(null);
    try {
      await request(`/api/v1/tracking/${item.entity.id}`, { method: "DELETE" });
      await onChanged();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not remove team",
      );
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="page teams-tracking-page theme-sports">
      <p className="eyebrow">NBA</p>
      <h1>Your teams.</h1>
      <p className="teams-tracking-intro">
        The teams you follow are ready to appear in upcoming events.
      </p>
      {error && <ErrorMessage message={error} />}
      {items.length === 0 && !error ? (
        <EmptyState
          title="No teams followed yet"
          detail="Choose NBA teams in Teams to add them here."
        />
      ) : (
        <div className="teams-tracking-grid motion-list">
          {items.map((item) => (
            <TeamCard
              entity={item.entity}
              key={item.entity.id}
              onUntrack={() => void untrack(item)}
              tracked
              tracking={removing === item.entity.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
