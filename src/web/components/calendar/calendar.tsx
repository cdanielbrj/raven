import "./calendar.css";
import { calendarDays, isEventOnDay } from "../../helpers/formatters";
import { CalendarDay } from "../calendar-day/calendar-day";
import type { TimelineEvent } from "../../types";

export function Calendar({
  start,
  events,
}: {
  start: Date;
  events: TimelineEvent[];
}) {
  return (
    <div className="week-calendar">
      {calendarDays(start).map((day) => (
        <CalendarDay
          day={day}
          events={events.filter((event) => isEventOnDay(event, day))}
          key={day.toISOString()}
        />
      ))}
    </div>
  );
}
