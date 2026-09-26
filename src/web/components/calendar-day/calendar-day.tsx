import "./calendar-day.css";
import type { ReactNode } from "react";
import { formatCalendarDay, isTodayDate } from "../../helpers/formatters";
import { CalendarCard } from "../card-calendar/card-calendar";
import type { TimelineEvent } from "../../types";

export function CalendarDay({
  day,
  events,
  renderEvent,
}: {
  day: Date;
  events: TimelineEvent[];
  renderEvent?: (event: TimelineEvent) => ReactNode;
}) {
  const today = isTodayDate(day);
  return (
    <section
      className={
        today ? "day-group calendar-day today" : "day-group calendar-day"
      }
    >
      <header className="day-heading">
        <h2>{formatCalendarDay(day)}</h2>
        <span>
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </header>
      <div className="calendar-events motion-list">
        {events.length ? (
          events.map((event) =>
            renderEvent ? (
              <span key={event.id}>{renderEvent(event)}</span>
            ) : (
              <CalendarCard event={event} key={event.id} />
            ),
          )
        ) : (
          <p className="calendar-empty">No events</p>
        )}
      </div>
    </section>
  );
}
