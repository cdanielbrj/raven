import "./card-default.css";
import { metadataLabel } from "../../helpers/formatters";
import type { Entity } from "../../types";

export function DefaultCard({
  entity,
  tracked,
  tracking,
  onTrack,
}: {
  entity: Entity;
  tracked: boolean;
  tracking: boolean;
  onTrack: (entity: Entity) => void;
}) {
  return (
    <article className="entity-card">
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
        disabled={tracked || tracking}
        onClick={() => onTrack(entity)}
      >
        {tracked ? "Tracked" : tracking ? "Tracking…" : "Track"}
      </button>
    </article>
  );
}
