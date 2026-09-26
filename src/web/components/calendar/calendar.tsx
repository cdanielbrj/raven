import "./calendar.css";
import type { ReactNode } from "react";
import { calendarDays, isEventOnDay } from "../../helpers/formatters";
import { CalendarDay } from "../calendar-day/calendar-day";
import type { TimelineEvent } from "../../types";

export function Calendar({
  start,
  events,
  renderEvent,
}: {
  start: Date;
  events: TimelineEvent[];
  renderEvent?: (event: TimelineEvent) => ReactNode;
}) {
  return (
    <div className="week-calendar">
      {calendarDays(start).map((day) => (
        <CalendarDay
          day={day}
          events={events.filter((event) => isEventOnDay(event, day))}
          key={day.toISOString()}
          renderEvent={renderEvent}
        />
      ))}
    </div>
  );
}
