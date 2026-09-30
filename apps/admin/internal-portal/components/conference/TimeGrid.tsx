"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MINUTES_PER_DAY,
  dayHeader,
  formatMinutes,
  isToday,
  istDateOf,
  layoutLanes,
  minutesOfDay,
} from "@/lib/conference/calendar";
import type { ConferenceBooking } from "@/lib/queries/conference";
import { eventStyle, isResizable, neighbourLimits } from "./shared";
import { useEventResize } from "./useEventResize";

// The Day and Week views: one column per date, the hours of the day down the side. Events sit
// where their times say and can be stretched or contracted by dragging their top or bottom
// edge (useEventResize) — the drag redraws live and saves on release. Bookings of different
// rooms that overlap in time sit side by side (layoutLanes). Clicking an empty spot starts a
// booking at that time. The grid scrolls (all 24 hours exist, so nothing booked early or late
// is hidden) and opens scrolled to the working day.

const HOUR_PX = 56;
const PX_PER_MINUTE = HOUR_PX / 60;
const GUTTER_PX = 60;
const INITIAL_SCROLL_HOUR = 8;
const MIN_EVENT_PX = 20;

/** What a drag hands back on release: the booking and the day column it was dragged in. */
interface GridTarget {
  id: string;
  startMin: number;
  endMin: number;
  booking: ConferenceBooking;
  date: string;
}

export interface SlotSelection {
  date: string;
  startMin: number;
  endMin: number;
}

export function TimeGrid({
  dates,
  bookings,
  roomColors,
  showRoomName,
  onSelect,
  onCreate,
  onResize,
}: {
  dates: string[];
  /** Confirmed bookings, already narrowed to the room filter. */
  bookings: ConferenceBooking[];
  roomColors: Map<string, string>;
  showRoomName: boolean;
  onSelect: (booking: ConferenceBooking) => void;
  onCreate: (slot: SlotSelection) => void;
  onResize: (booking: ConferenceBooking, date: string, startMin: number, endMin: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  // Open at the start of the working day, and again whenever the dates on screen change.
  const firstDate = dates[0];
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: INITIAL_SCROLL_HOUR * HOUR_PX - 8 });
  }, [firstDate, dates.length]);

  // Keeps the "now" line (and what counts as finished) current without a reload.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { preview, handleProps } = useEventResize<GridTarget>({
    axis: "y",
    pxPerMinute: PX_PER_MINUTE,
    onCommit: (target, startMin, endMin) => onResize(target.booking, target.date, startMin, endMin),
  });

  return (
    <div ref={scrollRef} className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-surface">
      <div
        className="grid"
        style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(${dates.length}, minmax(${dates.length > 1 ? 120 : 240}px, 1fr))` }}
      >
        {/* Header row: sticky so the dates stay visible while the hours scroll. */}
        <div className="sticky top-0 z-30 border-b border-border bg-surface" />
        {dates.map((date) => {
          const { weekday, day } = dayHeader(date);
          return (
            <div key={date} className="sticky top-0 z-30 border-b border-l border-border bg-surface py-2 text-center">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{weekday}</div>
              <div
                className={
                  "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold " +
                  (isToday(date) ? "bg-accent text-accent-foreground" : "text-foreground")
                }
              >
                {day}
              </div>
            </div>
          );
        })}

        {/* Hour labels */}
        <div className="relative" style={{ height: HOUR_PX * 24 }}>
          {Array.from({ length: 23 }, (_, i) => i + 1).map((hour) => (
            <div
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted"
              style={{ top: hour * HOUR_PX }}
            >
              {formatMinutes(hour * 60)}
            </div>
          ))}
        </div>

        {dates.map((date) => (
          <DayColumn
            key={date}
            date={date}
            bookings={bookings}
            roomColors={roomColors}
            showRoomName={showRoomName}
            now={now}
            preview={preview}
            handleProps={handleProps}
            onSelect={onSelect}
            onCreate={onCreate}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  date,
  bookings,
  roomColors,
  showRoomName,
  now,
  preview,
  handleProps,
  onSelect,
  onCreate,
}: {
  date: string;
  bookings: ConferenceBooking[];
  roomColors: Map<string, string>;
  showRoomName: boolean;
  now: number;
  preview: ReturnType<typeof useEventResize<GridTarget>>["preview"];
  handleProps: ReturnType<typeof useEventResize<GridTarget>>["handleProps"];
  onSelect: (booking: ConferenceBooking) => void;
  onCreate: (slot: SlotSelection) => void;
}) {
  const dayBookings = useMemo(() => bookings.filter((b) => istDateOf(b.startsAt) === date), [bookings, date]);
  const laid = useMemo(
    () =>
      layoutLanes(
        dayBookings.map((booking) => ({
          booking,
          startMin: minutesOfDay(booking.startsAt, date),
          endMin: Math.max(minutesOfDay(booking.endsAt, date), minutesOfDay(booking.startsAt, date) + 15),
        })),
      ),
    [dayBookings, date],
  );
  const nowMinutes = isToday(date) ? minutesOfDay(new Date(now).toISOString(), date) : null;

  return (
    <div
      className="relative cursor-cell border-l border-border"
      style={{
        height: HOUR_PX * 24,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px, var(--border) ${HOUR_PX}px)`,
      }}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const minutes = (event.clientY - rect.top) / PX_PER_MINUTE;
        const startMin = Math.min(MINUTES_PER_DAY - 60, Math.floor(minutes / 30) * 30);
        onCreate({ date, startMin, endMin: startMin + 60 });
      }}
    >
      {laid.map(({ booking, startMin: committedStart, endMin: committedEnd, lane, lanes }) => {
        const live = preview?.id === booking.id ? preview : null;
        const startMin = live?.startMin ?? committedStart;
        const endMin = live?.endMin ?? committedEnd;
        const resizable = isResizable(booking, now);
        const limits = neighbourLimits(booking, bookings, date, committedStart, committedEnd);
        const target: GridTarget = { id: booking.id, startMin: committedStart, endMin: committedEnd, booking, date };
        const color = roomColors.get(booking.roomId) ?? "var(--accent)";
        const height = Math.max((endMin - startMin) * PX_PER_MINUTE, MIN_EVENT_PX);

        return (
          <div
            key={booking.id}
            role="button"
            tabIndex={0}
            aria-label={`${booking.eventName}, ${booking.roomName}, ${formatMinutes(startMin)} to ${formatMinutes(endMin)}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(booking);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(booking);
              }
            }}
            className={
              "absolute cursor-pointer overflow-hidden rounded-md px-1.5 py-1 text-xs shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent " +
              (live ? "z-20 shadow-lg ring-2 ring-accent/60" : "z-10")
            }
            style={{
              ...eventStyle(color),
              top: startMin * PX_PER_MINUTE,
              height,
              left: `calc(${(lane / lanes) * 100}% + 2px)`,
              width: `calc(${100 / lanes}% - 4px)`,
            }}
          >
            <p className="truncate font-semibold text-foreground">{booking.eventName}</p>
            <p className="truncate text-[10px] text-muted tabular-nums">
              {formatMinutes(startMin)} – {formatMinutes(endMin)}
            </p>
            {height > 52 ? (
              <p className="truncate text-[10px] text-muted">
                {showRoomName ? `${booking.roomName} · ` : ""}
                {booking.employeeName}
              </p>
            ) : null}

            {resizable ? (
              <>
                <div
                  aria-hidden
                  title="Drag to change the start time"
                  className="absolute inset-x-0 top-0 h-2 cursor-ns-resize touch-none"
                  {...handleProps(target, "start", limits)}
                />
                <div
                  aria-hidden
                  title="Drag to change the end time"
                  className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize touch-none items-end justify-center"
                  {...handleProps(target, "end", limits)}
                >
                  <span className="mb-px h-0.5 w-6 rounded-full bg-foreground/30" />
                </div>
              </>
            ) : null}
          </div>
        );
      })}

      {nowMinutes !== null ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: nowMinutes * PX_PER_MINUTE }}>
          <span className="-ml-1 size-2 rounded-full bg-danger" />
          <span className="h-px flex-1 bg-danger" />
        </div>
      ) : null}
    </div>
  );
}
