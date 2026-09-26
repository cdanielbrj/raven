import { useCallback, useEffect, useState } from "react";
import { request } from "../../../api";
import { ComingSoonCard } from "../../../themes/anime/components/coming-soon-card/card-coming-soon";
import { TrackedCard } from "../../../themes/anime/components/tracked-card/card-tracked";
import { EmptyState } from "../../../themes/raven/components/empty-state/empty-state";
import { ErrorMessage } from "../../../themes/raven/components/error-message/error-message";
import type { TrackedItem } from "../../../types";
import "./tracking-view.css";

export function TrackingView({
  onChanged,
}: {
  onChanged: () => Promise<TrackedItem[]>;
}) {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setItems(await onChanged());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load tracking",
      );
    }
  }, [onChanged]);
  useEffect(() => {
    void load();
  }, [load]);
  const untrack = async (entityId: string) => {
    await request(`/api/v1/tracking/${entityId}`, { method: "DELETE" });
    await load();
  };
  const pendingSync = items.filter((item) => item.syncStatus === "pending");
  const synced = items.filter((item) => item.syncStatus === "synced");
  const airing = synced.filter((item) => item.nextEvent);
  const comingSoon = synced.filter((item) => !item.nextEvent);
  return (
    <section className="page theme-anime">
      <p className="eyebrow">TRACKING</p>
      <h1>What Raven watches.</h1>
      {error && <ErrorMessage message={error} />}
      {items.length === 0 && !error && (
        <EmptyState
          title="Nothing tracked yet"
          detail="Discovery is where you choose what Raven should watch."
        />
      )}
      {airing.length > 0 && (
        <section className="tracking-section">
          <p className="section-label">Airing</p>
          <div className="tracking-list motion-list">
            {airing.map((item) => (
              <TrackedCard
                item={item}
                onUntrack={(entityId) => void untrack(entityId)}
                key={item.entity.id}
              />
            ))}
          </div>
        </section>
      )}
      {pendingSync.length > 0 && (
        <section className="tracking-section">
          <p className="section-label">Following</p>
          <p className="tracking-description">
            Saved locally and waiting for schedule details.
          </p>
          <div className="coming-soon-grid motion-list">
            {pendingSync.map((item) => (
              <ComingSoonCard
                item={item}
                detail="Waiting for schedule details"
                onUntrack={(entityId) => void untrack(entityId)}
                key={item.entity.id}
              />
            ))}
          </div>
        </section>
      )}
      {comingSoon.length > 0 && (
        <section className="tracking-section">
          <p className="section-label">Coming soon</p>
          <div className="coming-soon-grid motion-list">
            {comingSoon.map((item) => (
              <ComingSoonCard
                item={item}
                onUntrack={(entityId) => void untrack(entityId)}
                key={item.entity.id}
              />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
