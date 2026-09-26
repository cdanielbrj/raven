import type { TimelineEvent } from "../../../../types";
import "./game-matchup.css";

export function GameMatchup({ event }: { event: TimelineEvent }) {
  const awayTeam = event.metadata?.awayTeam;
  const homeTeam = event.metadata?.homeTeam;
  if (!awayTeam || !homeTeam) return null;

  return (
    <div
      className="game-matchup"
      aria-label={`${awayTeam.name} at ${homeTeam.name}`}
    >
      <span>{awayTeam.abbreviation}</span>
      <span className="game-matchup-at" aria-hidden="true">
        @
      </span>
      <span>{homeTeam.abbreviation}</span>
    </div>
  );
}
