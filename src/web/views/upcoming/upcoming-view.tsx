import { useEffect, useState } from "react";
import { request } from "../../api";
import { Calendar } from "../../components/calendar/calendar";
import { HeroHighlight } from "../../components/hero-highlight/hero-highlight";
import { calendarWeekStart, nextSectionLabel } from "../../helpers/formatters";
import { EmptyState } from "../../states/empty-state/empty-state";
import { ErrorMessage } from "../../states/error-message/error-message";
import type { TimelineEvent } from "../../types";
import "./upcoming-view.css";

export function UpcomingView({ format }: { format: "anime" | "sport" }) {
  const [items, setItems] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      if (format === "sport") {
        try {
          await request("/api/v1/sports/nba/refresh", { method: "POST" });
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not refresh schedule",
          );
        }
      }
      try {
        const data = await request<{ items: TimelineEvent[] }>(
          `/api/v1/upcoming?format=${format}`,
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
  }, [format]);

  const nextEvent = items.find(isFutureEvent);
  const thisWeek = calendarWeekStart();

  return (
    <section className="page home-page">
      <p className="eyebrow">{format === "sport" ? "NBA" : "UPCOMING"}</p>
      <h1>{format === "sport" ? "Your teams, next." : "What matters next."}</h1>
      {error && <ErrorMessage message={error} />}
      {!error && !loading && items.length === 0 && (
        <EmptyState
          title="Nothing on the timeline"
          detail={
            format === "sport"
              ? "No games are scheduled for your followed teams this week."
              : "Track an anime in Discovery and its upcoming episodes will appear here."
          }
        />
      )}
      {loading && <p className="muted">Loading upcoming events…</p>}
      {nextEvent && (
        <>
          <p className="section-label">{nextSectionLabel(nextEvent)}</p>
          <HeroHighlight event={nextEvent} />
        </>
      )}
      {!loading && items.length > 0 && (
        <div className="week">
          <p className="section-label">This week</p>
          <Calendar start={thisWeek} events={items} />
        </div>
      )}
    </section>
  );
}

function isFutureEvent(event: TimelineEvent): boolean {
  const value = event.startsAt ?? `${event.startsOn}T23:59:59`;
  return new Date(value).getTime() >= Date.now();
}
