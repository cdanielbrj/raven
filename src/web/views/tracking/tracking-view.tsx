import { useCallback, useEffect, useState } from "react";
import { request } from "../../api";
import { ComingSoonCard } from "../../components/card-coming-soon/card-coming-soon";
import { TrackedCard } from "../../components/card-tracked/card-tracked";
import { EmptyState } from "../../states/empty-state/empty-state";
import { ErrorMessage } from "../../states/error-message/error-message";
import type { TrackedItem } from "../../types";
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
  const airing = items.filter((item) => item.nextEvent);
  const comingSoon = items.filter((item) => !item.nextEvent);
  return (
    <section className="page">
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
