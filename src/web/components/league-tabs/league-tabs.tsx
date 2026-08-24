import "./league-tabs.css";

export interface LeagueTab {
  id: string;
  label: string;
}

export function LeagueTabs({
  leagues,
  activeLeague,
  onChange,
}: {
  leagues: readonly LeagueTab[];
  activeLeague: string;
  onChange: (league: string) => void;
}) {
  return (
    <div className="league-tabs" role="tablist" aria-label="Competitions">
      {leagues.map((league) => (
        <button
          aria-selected={league.id === activeLeague}
          className={
            league.id === activeLeague ? "league-tab active" : "league-tab"
          }
          key={league.id}
          onClick={() => onChange(league.id)}
          role="tab"
          type="button"
        >
          {league.label}
        </button>
      ))}
    </div>
  );
}
