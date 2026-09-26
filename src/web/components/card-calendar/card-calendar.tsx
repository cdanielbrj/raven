import "./card-calendar.css";
import { eventLabel, formatEventTime } from "../../helpers/formatters";
import { MediaCover } from "../media-cover/media-cover";
import { WatchProvider } from "../watch-provider/watch-provider";
import { GameMatchup } from "../game-matchup/game-matchup";
import type { TimelineEvent } from "../../types";

export function CalendarCard({ event }: { event: TimelineEvent }) {
  return (
    <div className="calendar-event">
      <article
        className={`timeline-event${event.format === "sport" ? " timeline-event-sport" : ""}`}
      >
        {event.format === "sport" ? (
          <GameMatchup event={event} />
        ) : (
          <MediaCover entity={event.entity} />
        )}
        <div className="timeline-copy">
          <h3>{event.name ?? event.entity.name}</h3>
          <div className="calendar-footer">
            <div>
              <p className="timeline-episode">
                {event.format === "sport" ? "NBA game" : eventLabel(event)}
              </p>
              <time className="calendar-time">{formatEventTime(event)}</time>
            </div>
            {event.format !== "sport" && (
              <WatchProvider
                availability={event.entity.metadata?.availability}
              />
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
