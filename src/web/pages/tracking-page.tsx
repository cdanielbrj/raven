import { useCallback, useEffect, useState } from "react";
import { request } from "../api";
import { Cover, Empty, ErrorMessage } from "../components/media";
import {
  comingSoonDescription,
  eventLabel,
  formatEventDate,
} from "../components/helpers/formatters";
import type { TrackedItem } from "../types";

export function TrackingPage({
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
        <Empty
          title="Nothing tracked yet"
          detail="Discovery is where you choose what Raven should watch."
        />
      )}
      {airing.length > 0 && (
        <TrackingGroup title="Airing" items={airing} onUntrack={untrack} />
      )}
      {comingSoon.length > 0 && (
        <ComingSoonGroup items={comingSoon} onUntrack={untrack} />
      )}
    </section>
  );
}
function TrackingGroup({
  title,
  items,
  onUntrack,
}: {
  title: string;
  items: TrackedItem[];
  onUntrack: (entityId: string) => Promise<void>;
}) {
  return (
    <section className="tracking-section">
      <p className="section-label">{title}</p>
      <div className="tracking-list motion-list">
        {items.map((item) => (
          <article className="tracked-item" key={item.entity.id}>
            <Cover entity={item.entity} />
            <div className="tracked-copy">
              <span className="format-tag">{item.entity.format}</span>
              <h2>{item.entity.name}</h2>
              <p>
                {item.nextEvent
                  ? `${eventLabel(item.nextEvent)} · ${formatEventDate(item.nextEvent)}`
                  : comingSoonDescription(item.entity)}
              </p>
            </div>
            <button
              className="quiet-button"
              onClick={() => void onUntrack(item.entity.id!)}
            >
              Untrack
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
function ComingSoonGroup({
  items,
  onUntrack,
}: {
  items: TrackedItem[];
  onUntrack: (entityId: string) => Promise<void>;
}) {
  return (
    <section className="tracking-section">
      <p className="section-label">Coming soon</p>
      <div className="coming-soon-grid motion-list">
        {items.map((item) => (
          <article className="coming-soon-card" key={item.entity.id}>
            {item.entity.coverUrl ? (
              <img src={item.entity.coverUrl} alt="" />
            ) : (
              <div className="coming-soon-fallback">R</div>
            )}
            <div className="coming-soon-copy">
              <span className="format-tag">{item.entity.format}</span>
              <h2>{item.entity.name}</h2>
              <p>{comingSoonDescription(item.entity)}</p>
            </div>
            <button
              className="untrack-overlay"
              onClick={() => void onUntrack(item.entity.id!)}
            >
              Untrack
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
