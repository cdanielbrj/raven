import "./media-cover.css";
import type { Entity, TimelineEvent } from "../../../../types";

export function MediaCover({
  entity,
}: {
  entity: Pick<Entity, "coverUrl"> | TimelineEvent["entity"];
}) {
  return (
    <div className="mini-cover">
      {entity.coverUrl ? <img src={entity.coverUrl} alt="" /> : <span>R</span>}
    </div>
  );
}
