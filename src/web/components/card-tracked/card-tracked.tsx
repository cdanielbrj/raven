import "./card-tracked.css";
import { eventLabel, formatEventDate } from "../../helpers/formatters";
import { MediaCover } from "../media-cover/media-cover";
import type { TrackedItem } from "../../types";

export function TrackedCard({
  item,
  onUntrack,
}: {
  item: TrackedItem;
  onUntrack: (entityId: string) => void;
}) {
  return (
    <article className="tracked-item">
      <MediaCover entity={item.entity} />
      <div className="tracked-copy">
        <span className="format-tag">{item.entity.format}</span>
        <h2>{item.entity.name}</h2>
        {item.nextEvent && (
          <p>
            {eventLabel(item.nextEvent)} · {formatEventDate(item.nextEvent)}
          </p>
        )}
      </div>
      {item.entity.id && (
        <button
          className="quiet-button"
          onClick={() => onUntrack(item.entity.id!)}
        >
          Untrack
        </button>
      )}
    </article>
  );
}
