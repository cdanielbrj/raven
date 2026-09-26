import type { ReactNode } from "react";
import type { TimelineEvent } from "../../../../types";
import { Calendar } from "../calendar/calendar";
import "./week-calendar.css";

export function WeekCalendar({
  start,
  events,
  renderEvent,
}: {
  start: Date;
  events: TimelineEvent[];
  renderEvent: (event: TimelineEvent) => ReactNode;
}) {
  return (
    <div className="week-calendar-section">
      <p className="section-label">This week</p>
      <Calendar start={start} events={events} renderEvent={renderEvent} />
    </div>
  );
}
