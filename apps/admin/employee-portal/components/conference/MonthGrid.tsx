"use client";

import { useMemo } from "react";
import { MINUTES_PER_DAY, dayHeader, formatMinutes, isToday, istDateOf, minutesOfDay, monthGridDates, pastCutoffMinutes } from "@/lib/conference/calendar";
import type { ConferenceBooking } from "@/lib/queries/conference";

// The Month view: a Monday-first grid of whole weeks. Each day lists its bookings as compact
// chips (a room-coloured dot, the start time, the event) — at this scale there's no time axis
// to stretch a booking along, so resizing lives in the Day / Week / Timeline views; "+N more"
// and a click on the date open that day. Clicking empty space in a day starts a booking.

const MAX_CHIPS = 3;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({
  date,
  bookings,
  roomColors,
  onSelect,
  onCreate,
  onOpenDay,
}: {
  /** Any date in the month being shown. */
  date: string;
  /** Confirmed bookings, already narrowed to the room filter. */
  bookings: ConferenceBooking[];
  roomColors: Map<string, string>;
  onSelect: (booking: ConferenceBooking) => void;
  /** Start a booking on this day (the form opens with 9–10 AM). */
  onCreate: (date: string) => void;
  onOpenDay: (date: string) => void;
}) {
  const dates = useMemo(() => monthGridDates(date), [date]);
  const month = date.slice(0, 7);
  const byDay = useMemo(() => {
    const map = new Map<string, ConferenceBooking[]>();
    for (const booking of bookings) {
      const day = istDateOf(booking.startsAt);
      map.set(day, [...(map.get(day) ?? []), booking]);
    }
    return map;
  }, [bookings]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((day, index) => {
          const inMonth = day.slice(0, 7) === month;
          const dayBookings = byDay.get(day) ?? [];
          const shown = dayBookings.slice(0, MAX_CHIPS);
          const extra = dayBookings.length - shown.length;
          // A day that's already over can't take a booking; its bookings stay clickable.
          const isPast = pastCutoffMinutes(day) >= MINUTES_PER_DAY;
          return (
            <div
              key={day}
              onClick={() => !isPast && onCreate(day)}
              title={isPast ? "This day has passed" : undefined}
              className={
                "flex min-h-28 flex-col gap-1 border-border p-1.5 transition-colors " +
                (isPast ? "cursor-not-allowed " : "cursor-cell hover:bg-surface-secondary/40 ") +
                (index % 7 !== 0 ? "border-l " : "") +
                (index >= 7 ? "border-t " : "") +
                (inMonth ? "" : "bg-surface-secondary/30")
              }
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenDay(day);
                }}
                title="Open this day"
                className={
                  "flex size-6 items-center justify-center rounded-full text-xs font-semibold outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent " +
                  (isToday(day) ? "bg-accent text-accent-foreground hover:bg-accent" : inMonth ? "text-foreground" : "text-muted")
                }
              >
                {dayHeader(day).day}
              </button>
              {shown.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(booking);
                  }}
                  title={`${booking.eventName} — ${booking.roomName}`}
                  className="flex w-full items-center gap-1.5 truncate rounded px-1 py-0.5 text-left text-[11px] outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: roomColors.get(booking.roomId) ?? "var(--accent)" }} />
                  <span className="shrink-0 tabular-nums text-muted">{formatMinutes(minutesOfDay(booking.startsAt, day))}</span>
                  <span className="truncate font-medium text-foreground">{booking.eventName}</span>
                </button>
              ))}
              {extra > 0 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenDay(day);
                  }}
                  className="px-1 text-left text-[11px] font-medium text-accent hover:underline"
                >
                  +{extra} more
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
