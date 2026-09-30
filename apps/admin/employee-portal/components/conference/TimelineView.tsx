"use client";

import { useEffect, useRef, useState } from "react";
import {
  MINUTES_PER_DAY,
  formatMinutes,
  isToday,
  istDateOf,
  minutesOfDay,
} from "@/lib/conference/calendar";
import type { ConferenceBooking, ConferenceRoom } from "@/lib/queries/conference";
import type { SlotSelection } from "./TimeGrid";
import { eventStyle, isResizable, neighbourLimits } from "./shared";
import { useEventResize } from "./useEventResize";

// The Timeline view: one row per room, the day's hours running left to right — so you can
// see at a glance which rooms are free when. Bars can be stretched or contracted by dragging
// their left or right edge (useEventResize, same as the grid's top/bottom). Rooms can't
// double-book, so a row never has overlapping bars and needs no lanes. Clicking an empty
// spot in a row starts a booking for that room at that time. Scrolls sideways, opening at the
// working day; the room names stay pinned on the left.

const HOUR_PX = 84;
const PX_PER_MINUTE = HOUR_PX / 60;
const LABEL_PX = 168;
const ROW_PX = 64;
const INITIAL_SCROLL_HOUR = 8;

interface TimelineTarget {
  id: string;
  startMin: number;
  endMin: number;
  booking: ConferenceBooking;
}

export function TimelineView({
  date,
  rooms,
  bookings,
  roomColors,
  onSelect,
  onCreate,
  onResize,
}: {
  date: string;
  /** The rows: the rooms to show (already narrowed to the room filter). */
  rooms: ConferenceRoom[];
  /** Confirmed bookings on `date`. */
  bookings: ConferenceBooking[];
  roomColors: Map<string, string>;
  onSelect: (booking: ConferenceBooking) => void;
  onCreate: (slot: SlotSelection & { roomId: string }) => void;
  onResize: (booking: ConferenceBooking, date: string, startMin: number, endMin: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: INITIAL_SCROLL_HOUR * HOUR_PX - 12 });
  }, [date]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { preview, handleProps } = useEventResize<TimelineTarget>({
    axis: "x",
    pxPerMinute: PX_PER_MINUTE,
    onCommit: (target, startMin, endMin) => onResize(target.booking, date, startMin, endMin),
  });

  const dayBookings = bookings.filter((b) => istDateOf(b.startsAt) === date);
  const nowMinutes = isToday(date) ? minutesOfDay(new Date(now).toISOString(), date) : null;
  const trackWidth = HOUR_PX * 24;

  if (rooms.length === 0) {
    return <p className="rounded-xl border-2 border-dashed border-border px-4 py-8 text-center text-sm text-muted">No conference rooms to show.</p>;
  }

  return (
    <div ref={scrollRef} className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-surface">
      <div style={{ width: LABEL_PX + trackWidth }}>
        {/* Hour header: sticky to the top; its corner cell also sticks to the left. */}
        <div className="sticky top-0 z-30 flex border-b border-border bg-surface">
          <div className="sticky left-0 z-40 shrink-0 border-r border-border bg-surface" style={{ width: LABEL_PX }} />
          <div className="relative h-9" style={{ width: trackWidth }}>
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="absolute top-0 flex h-full items-center border-l border-border pl-1.5 text-[10px] tabular-nums text-muted"
                style={{ left: hour * HOUR_PX, width: HOUR_PX }}
              >
                {formatMinutes(hour * 60)}
              </div>
            ))}
          </div>
        </div>

        {rooms.map((room) => {
          const roomBookings = dayBookings.filter((b) => b.roomId === room.id);
          const color = roomColors.get(room.id) ?? "var(--accent)";
          return (
            <div key={room.id} className="flex border-b border-border last:border-b-0" style={{ height: ROW_PX }}>
              <div
                className="sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-0.5 border-r border-border bg-surface px-3"
                style={{ width: LABEL_PX }}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate text-sm font-medium text-foreground" title={room.name}>
                    {room.name}
                  </span>
                </div>
                <span className="pl-[18px] text-[11px] text-muted">
                  {room.status === "inactive" ? "Removed" : room.capacity ? `Seats ${room.capacity}` : " "}
                </span>
              </div>

              <div
                className="relative cursor-cell"
                style={{
                  width: trackWidth,
                  backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px, var(--border) ${HOUR_PX}px)`,
                }}
                onClick={(event) => {
                  if (room.status !== "active") return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const minutes = (event.clientX - rect.left) / PX_PER_MINUTE;
                  const startMin = Math.min(MINUTES_PER_DAY - 60, Math.floor(minutes / 30) * 30);
                  onCreate({ date, roomId: room.id, startMin, endMin: startMin + 60 });
                }}
              >
                {roomBookings.map((booking) => {
                  const committedStart = minutesOfDay(booking.startsAt, date);
                  const committedEnd = Math.max(minutesOfDay(booking.endsAt, date), committedStart + 15);
                  const live = preview?.id === booking.id ? preview : null;
                  const startMin = live?.startMin ?? committedStart;
                  const endMin = live?.endMin ?? committedEnd;
                  const resizable = isResizable(booking, now);
                  const limits = neighbourLimits(booking, bookings, date, committedStart, committedEnd);
                  const target: TimelineTarget = { id: booking.id, startMin: committedStart, endMin: committedEnd, booking };
                  const width = Math.max((endMin - startMin) * PX_PER_MINUTE, 24);

                  return (
                    <div
                      key={booking.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${booking.eventName}, ${room.name}, ${formatMinutes(startMin)} to ${formatMinutes(endMin)}`}
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
                        "absolute flex cursor-pointer flex-col justify-center overflow-hidden rounded-md px-2.5 text-xs shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent " +
                        (live ? "z-20 shadow-lg ring-2 ring-accent/60" : "z-10")
                      }
                      style={{ ...eventStyle(color), left: startMin * PX_PER_MINUTE, width, top: 7, bottom: 7 }}
                    >
                      <p className="truncate font-semibold text-foreground">{booking.eventName}</p>
                      <p className="truncate text-[10px] text-muted tabular-nums">
                        {formatMinutes(startMin)} – {formatMinutes(endMin)}
                      </p>

                      {resizable ? (
                        <>
                          <div
                            aria-hidden
                            title="Drag to change the start time"
                            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize touch-none"
                            {...handleProps(target, "start", limits)}
                          />
                          <div
                            aria-hidden
                            title="Drag to change the end time"
                            className="absolute inset-y-0 right-0 flex w-2 cursor-ew-resize touch-none items-center justify-end"
                            {...handleProps(target, "end", limits)}
                          >
                            <span className="mr-px h-6 w-0.5 rounded-full bg-foreground/30" />
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })}

                {nowMinutes !== null ? (
                  <div aria-hidden className="pointer-events-none absolute inset-y-0 z-20 w-px bg-danger" style={{ left: nowMinutes * PX_PER_MINUTE }} />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
