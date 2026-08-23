import "./hero-highlight.css";
import { eventLabel, formatEventTime } from "../../helpers/formatters";
import { MediaCover } from "../media-cover/media-cover";
import { TrailerPreview } from "../trailer-preview/trailer-preview";
import { WatchProvider } from "../watch-provider/watch-provider";
import type { TimelineEvent } from "../../types";

export function HeroHighlight({ event }: { event: TimelineEvent }) {
  return (
    <article className="next-event featured-event">
      <div className="featured-details">
        <MediaCover entity={event.entity} />
        <div className="featured-copy">
          <h2>{event.entity.name}</h2>
          <p>{eventLabel(event)}</p>
          <div className="featured-footer">
            <time>{formatEventTime(event)}</time>
            <WatchProvider
              availability={event.entity.metadata?.availability}
              variant="hero"
            />
          </div>
        </div>
      </div>
      <TrailerPreview entity={event.entity} />
    </article>
  );
}
