import { useEffect, useState } from "react";
import { request } from "../../../api";
import {
  calendarWeekStart,
  isFutureEvent,
  nextSectionLabel,
} from "../../../helpers/formatters";
import { EmptyState } from "../../../themes/raven/components/empty-state/empty-state";
import { ErrorMessage } from "../../../themes/raven/components/error-message/error-message";
import { WeekCalendar } from "../../../themes/raven/components/week-calendar/week-calendar";
import { GameCalendarCard } from "../../../themes/sports/components/game-calendar-card/game-calendar-card";
import { GameHighlight } from "../../../themes/sports/components/game-highlight/game-highlight";
import type { TimelineEvent } from "../../../types";

export function SportsUpcomingView() {
  const [items, setItems] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await request("/api/v1/sports/nba/refresh", { method: "POST" });
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not refresh schedule",
        );
      }
      try {
        const data = await request<{ items: TimelineEvent[] }>(
          "/api/v1/upcoming?format=sport",
        );
        setItems(data.items);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load upcoming events",
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const nextEvent = items.find(isFutureEvent);
  const thisWeek = calendarWeekStart();

  return (
    <section className="page home-page theme-sports">
      <p className="eyebrow">NBA</p>
      <h1>Your teams, next.</h1>
      {error && <ErrorMessage message={error} />}
      {!error && !loading && items.length === 0 && (
        <EmptyState
          title="Nothing on the timeline"
          detail="No games are scheduled for your followed teams this week."
        />
      )}
      {loading && <p className="muted">Loading upcoming events…</p>}
      {nextEvent && (
        <>
          <p className="section-label">{nextSectionLabel(nextEvent)}</p>
          <GameHighlight event={nextEvent} />
        </>
      )}
      {!loading && items.length > 0 && (
        <WeekCalendar
          start={thisWeek}
          events={items}
          renderEvent={(event) => <GameCalendarCard event={event} />}
        />
      )}
    </section>
  );
}
