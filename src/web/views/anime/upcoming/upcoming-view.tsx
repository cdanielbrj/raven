import { useEffect, useState } from "react";
import { request } from "../../../api";
import { AnimeCalendarCard } from "../../../themes/anime/components/calendar-card/card-calendar";
import { EpisodeHighlight } from "../../../themes/anime/components/episode-highlight/hero-highlight";
import { EmptyState } from "../../../themes/raven/components/empty-state/empty-state";
import { ErrorMessage } from "../../../themes/raven/components/error-message/error-message";
import { WeekCalendar } from "../../../themes/raven/components/week-calendar/week-calendar";
import {
  calendarWeekStart,
  isFutureEvent,
  nextSectionLabel,
} from "../../../helpers/formatters";
import type { TimelineEvent } from "../../../types";

export function AnimeUpcomingView() {
  const [items, setItems] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await request<{ items: TimelineEvent[] }>(
          "/api/v1/upcoming?format=anime",
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
    <section className="page home-page theme-anime">
      <p className="eyebrow">UPCOMING</p>
      <h1>What matters next.</h1>
      {error && <ErrorMessage message={error} />}
      {!error && !loading && items.length === 0 && (
        <EmptyState
          title="Nothing on the timeline"
          detail="Track an anime in Discovery and its upcoming episodes will appear here."
        />
      )}
      {loading && <p className="muted">Loading upcoming events…</p>}
      {nextEvent && (
        <>
          <p className="section-label">{nextSectionLabel(nextEvent)}</p>
          <EpisodeHighlight event={nextEvent} />
        </>
      )}
      {!loading && items.length > 0 && (
        <WeekCalendar
          start={thisWeek}
          events={items}
          renderEvent={(event) => <AnimeCalendarCard event={event} />}
        />
      )}
    </section>
  );
}
