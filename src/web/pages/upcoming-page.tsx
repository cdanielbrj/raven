import { useEffect, useState } from "react";
import { request } from "../api";
import {
  Cover,
  Empty,
  ErrorMessage,
  HeroBackground,
  usePrefersReducedMotion,
  WatchProvider,
} from "../components/media";
import {
  eventLabel,
  formatEventTime,
  groupByDay,
  isInThisCalendarWeek,
  nextSectionLabel,
} from "../components/helpers/formatters";
import type { TimelineEvent } from "../types";

export function UpcomingPage() {
  const [items, setItems] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    void request<{ items: TimelineEvent[] }>("/api/v1/upcoming?format=anime")
      .then((data) => setItems(data.items))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const [nextEvent, ...remainingEvents] = items;
  const thisWeek = remainingEvents.filter(isInThisCalendarWeek);
  const nextWeek = remainingEvents.filter(
    (event) => !isInThisCalendarWeek(event),
  );

  return (
    <section className="page home-page">
      <p className="eyebrow">UPCOMING</p>
      <h1>What matters next.</h1>
      {error && <ErrorMessage message={error} />}
      {!error && items.length === 0 && (
        <Empty
          title="Nothing on the timeline"
          detail="Track an anime in Discovery and its upcoming episodes will appear here."
        />
      )}
      {nextEvent && (
        <>
          <p className="section-label">{nextSectionLabel(nextEvent)}</p>
          <article className="next-event hero">
            <HeroBackground
              entity={nextEvent.entity}
              reduced={prefersReducedMotion}
            />
            <div className="hero-content">
              <div className="hero-panel">
                <div className="hero-copy">
                  <span className="format-tag">{nextEvent.entity.format}</span>
                  <h2>{nextEvent.entity.name}</h2>
                  <p>{eventLabel(nextEvent)}</p>
                </div>
                <div className="hero-side">
                  <WatchProvider
                    availability={nextEvent.entity.metadata?.availability}
                    variant="hero"
                  />
                  <time className="hero-time">
                    {formatEventTime(nextEvent)}
                  </time>
                </div>
              </div>
            </div>
          </article>
        </>
      )}
      <WeekSection title="This week" events={thisWeek} />
      <WeekSection title="Next week" events={nextWeek} />
    </section>
  );
}

function WeekSection({
  title,
  events,
}: {
  title: string;
  events: TimelineEvent[];
}) {
  if (!events.length) return null;
  return (
    <div className="week">
      <p className="section-label">{title}</p>
      {groupByDay(events).map(([day, dayEvents]) => (
        <section className="day-group" key={day}>
          <header className="day-heading">
            <h2>{day}</h2>
            <span>
              {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
            </span>
          </header>
          <div className="timeline motion-list">
            {dayEvents.map((event) => (
              <div className="timeline-entry" key={event.id}>
                <time className="timeline-time">{formatEventTime(event)}</time>
                <article className="timeline-event">
                  <Cover entity={event.entity} />
                  <div className="timeline-copy">
                    <span className="format-tag">{event.entity.format}</span>
                    <h3>{event.entity.name}</h3>
                    {event.entity.metadata?.genres?.[0] && (
                      <p className="timeline-genre">
                        {event.entity.metadata.genres[0]}
                      </p>
                    )}
                    <p className="timeline-episode">{eventLabel(event)}</p>
                    <WatchProvider
                      availability={event.entity.metadata?.availability}
                    />
                  </div>
                </article>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
