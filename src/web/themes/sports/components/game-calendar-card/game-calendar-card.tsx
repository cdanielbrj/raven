import { formatEventTime } from "../../../../helpers/formatters";
import type { TimelineEvent } from "../../../../types";
import { GameMatchup } from "../game-matchup/game-matchup";
import "./game-calendar-card.css";

export function GameCalendarCard({ event }: { event: TimelineEvent }) {
  return (
    <div className="calendar-event">
      <article className="game-calendar-card">
        <GameMatchup event={event} />
        <div className="game-calendar-copy">
          <h3>{event.name ?? event.entity.name}</h3>
          <p>NBA game</p>
          <time>{formatEventTime(event)}</time>
        </div>
      </article>
    </div>
  );
}
