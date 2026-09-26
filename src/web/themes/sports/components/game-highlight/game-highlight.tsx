import { formatEventTime } from "../../../../helpers/formatters";
import type { TimelineEvent } from "../../../../types";
import { GameMatchup } from "../game-matchup/game-matchup";
import "./game-highlight.css";

export function GameHighlight({ event }: { event: TimelineEvent }) {
  return (
    <article className="game-highlight">
      <GameMatchup event={event} />
      <div className="game-highlight-copy">
        <p>UPCOMING GAME</p>
        <h2>{event.name ?? event.entity.name}</h2>
        <time>{formatEventTime(event)}</time>
      </div>
    </article>
  );
}
