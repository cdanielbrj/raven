import "./hero-highlight.css";
import { eventLabel, formatEventTime } from "../../helpers/formatters";
import { MediaCover } from "../media-cover/media-cover";
import { TrailerPreview } from "../trailer-preview/trailer-preview";
import { WatchProvider } from "../watch-provider/watch-provider";
import { GameMatchup } from "../game-matchup/game-matchup";
import type { TimelineEvent } from "../../types";

export function HeroHighlight({ event }: { event: TimelineEvent }) {
  return (
    <article
      className={`next-event featured-event${event.format === "sport" ? " featured-event-sport" : ""}`}
    >
      <div className="featured-details">
        {event.format === "sport" ? (
          <GameMatchup event={event} />
        ) : (
          <MediaCover entity={event.entity} />
        )}
        <div className="featured-copy">
          <h2>{event.name ?? event.entity.name}</h2>
          <p>{event.format === "sport" ? "NBA game" : eventLabel(event)}</p>
          <div className="featured-footer">
            <time>{formatEventTime(event)}</time>
            {event.format !== "sport" && (
              <WatchProvider
                availability={event.entity.metadata?.availability}
                variant="hero"
              />
            )}
          </div>
        </div>
      </div>
      {event.format !== "sport" && <TrailerPreview entity={event.entity} />}
    </article>
  );
}
