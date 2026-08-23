import { useEffect, useState } from "react";
import { request } from "../../api";
import { Calendar } from "../../components/calendar/calendar";
import { HeroHighlight } from "../../components/hero-highlight/hero-highlight";
import { calendarWeekStart, nextSectionLabel } from "../../helpers/formatters";
import { EmptyState } from "../../states/empty-state/empty-state";
import { ErrorMessage } from "../../states/error-message/error-message";
import type { TimelineEvent } from "../../types";
import "./upcoming-view.css";

export function UpcomingView() {
  const [items, setItems] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void request<{ items: TimelineEvent[] }>("/api/v1/upcoming?format=anime")
      .then((data) => setItems(data.items))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const nextEvent = items.find(isFutureEvent);
  const thisWeek = calendarWeekStart();

  return (
    <section className="page home-page">
      <p className="eyebrow">UPCOMING</p>
      <h1>What matters next.</h1>
      {error && <ErrorMessage message={error} />}
      {!error && items.length === 0 && (
        <EmptyState
          title="Nothing on the timeline"
          detail="Track an anime in Discovery and its upcoming episodes will appear here."
        />
      )}
      {nextEvent && (
        <>
          <p className="section-label">{nextSectionLabel(nextEvent)}</p>
          <HeroHighlight event={nextEvent} />
        </>
      )}
      <div className="week">
        <p className="section-label">This week</p>
        <Calendar start={thisWeek} events={items} />
      </div>
    </section>
  );
}

function isFutureEvent(event: TimelineEvent): boolean {
  const value = event.startsAt ?? `${event.startsOn}T23:59:59`;
  return new Date(value).getTime() >= Date.now();
}
