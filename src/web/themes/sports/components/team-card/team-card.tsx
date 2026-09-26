import type { Entity } from "../../../../types";
import "./team-card.css";

export function TeamCard({
  entity,
  tracked,
  tracking,
  onTrack,
  onUntrack,
}: {
  entity: Entity;
  tracked: boolean;
  tracking: boolean;
  onTrack?: (entity: Entity) => void;
  onUntrack?: (entity: Entity) => void;
}) {
  const metadata = entity.metadata;
  const abbreviation = metadata?.abbreviation ?? entity.name.slice(0, 3);

  return (
    <article className="team-card">
      <div className="team-identity" aria-hidden="true">
        {entity.iconUrl ? (
          <img alt="" className="team-badge" src={entity.iconUrl} />
        ) : (
          <span className="team-monogram">{abbreviation}</span>
        )}
      </div>
      <div className="team-copy">
        <h2>{entity.name}</h2>
        <p className="team-conference">{metadata?.conference} Conference</p>
        <span className="team-division">{metadata?.division} Division</span>
      </div>
      <button
        className="team-follow-button"
        aria-label={
          tracked
            ? onUntrack
              ? `Unfollow ${entity.name}`
              : `Following ${entity.name}`
            : `Follow ${entity.name}`
        }
        disabled={tracking || (tracked ? !onUntrack : !onTrack)}
        onClick={() => (tracked ? onUntrack?.(entity) : onTrack?.(entity))}
        type="button"
      >
        {tracking ? (
          <span className="team-follow-pending" aria-hidden="true" />
        ) : (
          <HeartIcon filled={tracked} />
        )}
      </button>
    </article>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path
        d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.8l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.4l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}
