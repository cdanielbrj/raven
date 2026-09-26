import "./card-coming-soon.css";
import { comingSoonDescription } from "../../../../helpers/formatters";
import type { TrackedItem } from "../../../../types";

export function ComingSoonCard({
  item,
  onUntrack,
  detail,
}: {
  item: TrackedItem;
  onUntrack: (entityId: string) => void;
  detail?: string;
}) {
  return (
    <article className="coming-soon-card">
      {item.entity.coverUrl ? (
        <img src={item.entity.coverUrl} alt="" />
      ) : (
        <div className="coming-soon-fallback">R</div>
      )}
      <div className="coming-soon-copy">
        <span className="format-tag">{item.entity.format}</span>
        <h2>{item.entity.name}</h2>
        <p>{detail ?? comingSoonDescription(item.entity)}</p>
      </div>
      {item.entity.id && (
        <button
          className="untrack-overlay"
          onClick={() => onUntrack(item.entity.id!)}
        >
          Untrack
        </button>
      )}
    </article>
  );
}
