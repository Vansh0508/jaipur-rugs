"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@heroui/react";
import { Button, Select } from "@jaipur-rugs/ui-kit";
import { updateConferenceBooking } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { todayInAppZone } from "@/lib/format";
import {
  CONFERENCE_VIEWS,
  istDateOf,
  istInstantMs,
  parseConferenceView,
  rangeLabel,
  roomColorMap,
  shiftDate,
  weekDates,
  type ConferenceView,
} from "@/lib/conference/calendar";
import type { ConferenceBooking, ConferenceRoom } from "@/lib/queries/conference";
import { ActionDialog } from "@/components/shared/ActionDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { BookingDetailsDialog } from "./BookingDetailsDialog";
import { BookingFormModal, type BookingDefaults } from "./BookingFormModal";
import { BookingsList } from "./BookingsList";
import { CancelBookingDialog } from "./CancelBookingDialog";
import { MonthGrid } from "./MonthGrid";
import { RoomsManager } from "./RoomsManager";
import { TimeGrid, type SlotSelection } from "./TimeGrid";
import { TimelineView } from "./TimelineView";

// Conference booking: three sections as Hero UI secondary tabs — Calendar (Day / Week / Month
// / Timeline, with stretch-to-resize), Bookings (the list) and Rooms (manage venues). The
// calendar's view, date and room filter live in the URL (?view=&date=&room=), so the server
// page fetches exactly the bookings around what's on screen and a link to a day is shareable;
// everything else is local state.
//
// Stretching or contracting a booking saves as soon as it's released: the new times show at
// once (optimistic), conference-booking-update is called, and if the server refuses (most
// often another booking in the way) the booking snaps back and the reason is shown.

type Section = "calendar" | "bookings" | "rooms";

const VIEW_LABEL: Record<ConferenceView, string> = { day: "Day", week: "Week", month: "Month", timeline: "Timeline" };

/** The next half hour (or 9 AM when that's before the working day) for "Book" with no slot picked. */
function defaultSlot(date: string): { startMin: number; endMin: number } {
  if (date === todayInAppZone()) {
    const nowIst = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
    const [h, m] = nowIst.split(":").map(Number);
    const startMin = Math.min(22 * 60, Math.ceil(((h ?? 0) * 60 + (m ?? 0) + 1) / 30) * 30);
    if (startMin >= 9 * 60) return { startMin, endMin: startMin + 60 };
  }
  return { startMin: 9 * 60, endMin: 10 * 60 };
}

export function ConferenceWorkspace({
  rooms,
  bookings: serverBookings,
  view,
  date,
  roomFilter,
}: {
  rooms: ConferenceRoom[];
  /** Confirmed and cancelled bookings around the visible range. */
  bookings: ConferenceBooking[];
  view: ConferenceView;
  date: string;
  /** "all" or a room id. */
  roomFilter: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [section, setSection] = useState<Section>("calendar");
  // Local copy so a resize shows instantly; re-synced whenever the server sends fresh data.
  const [bookings, setBookings] = useState(serverBookings);
  useEffect(() => setBookings(serverBookings), [serverBookings]);

  const [formState, setFormState] = useState<{ key: number; defaults: BookingDefaults } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ConferenceBooking | null>(null);
  const [resizeError, setResizeError] = useState<string | null>(null);

  const activeRooms = useMemo(() => rooms.filter((r) => r.status === "active"), [rooms]);
  const roomColors = useMemo(() => roomColorMap(rooms), [rooms]);
  const confirmed = useMemo(() => bookings.filter((b) => b.status === "confirmed"), [bookings]);
  const calendarBookings = useMemo(
    () => (roomFilter === "all" ? confirmed : confirmed.filter((b) => b.roomId === roomFilter)),
    [confirmed, roomFilter],
  );
  const selected = selectedId ? (bookings.find((b) => b.id === selectedId) ?? null) : null;

  // --- URL state ---------------------------------------------------------------------------
  function navigate(next: { view?: ConferenceView; date?: string; room?: string }) {
    const nextView = next.view ?? view;
    const nextDate = next.date ?? date;
    const nextRoom = next.room ?? roomFilter;
    const params = new URLSearchParams();
    if (nextView !== "week") params.set("view", nextView);
    if (nextDate !== todayInAppZone()) params.set("date", nextDate);
    if (nextRoom !== "all") params.set("room", nextRoom);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // --- booking form ------------------------------------------------------------------------
  function openForm(defaults: BookingDefaults) {
    setFormState((prev) => ({ key: (prev?.key ?? 0) + 1, defaults }));
  }

  function openBlankForm() {
    // The date the calendar is showing (or today when it's showing a past week / another month).
    const target = date < todayInAppZone() ? todayInAppZone() : date;
    openForm({ roomId: roomFilter !== "all" ? roomFilter : undefined, date: target, ...defaultSlot(target) });
  }

  function handleCreate(slot: SlotSelection & { roomId?: string }) {
    openForm({ roomId: slot.roomId ?? (roomFilter !== "all" ? roomFilter : undefined), date: slot.date, startMin: slot.startMin, endMin: slot.endMin });
  }

  // --- stretch / contract ------------------------------------------------------------------
  async function handleResize(booking: ConferenceBooking, day: string, startMin: number, endMin: number) {
    const startsAt = new Date(istInstantMs(day, startMin)).toISOString();
    const endsAt = new Date(istInstantMs(day, endMin)).toISOString();
    const before = { startsAt: booking.startsAt, endsAt: booking.endsAt };
    setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, startsAt, endsAt } : b)));
    try {
      await updateConferenceBooking(getBrowserSupabaseClient(), { bookingId: booking.id, startsAt, endsAt });
      router.refresh();
    } catch (err) {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, ...before } : b)));
      setResizeError(err instanceof Error ? err.message : "Could not change the booking's time.");
    }
  }

  // --- calendar body -----------------------------------------------------------------------
  const timelineRooms = useMemo(() => {
    const onDate = new Set(confirmed.filter((b) => istDateOf(b.startsAt) === date).map((b) => b.roomId));
    // Active rooms are always rows; a removed room only while it still has a booking that day.
    const rows = rooms.filter((r) => r.status === "active" || onDate.has(r.id));
    return roomFilter === "all" ? rows : rows.filter((r) => r.id === roomFilter);
  }, [rooms, confirmed, date, roomFilter]);

  const today = todayInAppZone();
  const roomOptions = [{ id: "all", label: "All rooms" }, ...rooms.map((r) => ({ id: r.id, label: r.status === "active" ? r.name : `${r.name} (removed)` }))];

  let calendarBody: React.ReactNode;
  if (view === "month") {
    calendarBody = (
      <MonthGrid
        date={date}
        bookings={calendarBookings}
        roomColors={roomColors}
        onSelect={(b) => setSelectedId(b.id)}
        onCreate={(day) => handleCreate({ date: day, startMin: 9 * 60, endMin: 10 * 60 })}
        onOpenDay={(day) => navigate({ view: "day", date: day })}
      />
    );
  } else if (view === "timeline") {
    calendarBody = (
      <TimelineView
        date={date}
        rooms={timelineRooms}
        bookings={calendarBookings}
        roomColors={roomColors}
        onSelect={(b) => setSelectedId(b.id)}
        onCreate={handleCreate}
        onResize={handleResize}
      />
    );
  } else {
    calendarBody = (
      <TimeGrid
        dates={view === "week" ? weekDates(date) : [date]}
        bookings={calendarBookings}
        roomColors={roomColors}
        showRoomName={roomFilter === "all"}
        onSelect={(b) => setSelectedId(b.id)}
        onCreate={handleCreate}
        onResize={handleResize}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Conference booking"
        description="Book the conference rooms, see what's free on the calendar or timeline, and stretch a meeting to change its length."
        action={
          <Button onPress={openBlankForm} isDisabled={activeRooms.length === 0}>
            Book conference room
          </Button>
        }
      />

      <Tabs variant="secondary" selectedKey={section} onSelectionChange={(key) => setSection(String(key) as Section)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Conference booking sections">
            <Tabs.Tab id="calendar">
              Calendar
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="bookings">
              Bookings
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="rooms">
              Rooms ({activeRooms.length})
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="calendar" className="flex flex-col gap-4 pt-4">
          {activeRooms.length === 0 && rooms.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <EmptyState message="There are no conference rooms yet. Add a room first, then bookings can be made here." />
              <Button variant="secondary" onPress={() => setSection("rooms")}>
                Add a conference room
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onPress={() => navigate({ date: today })} isDisabled={date === today}>
                    Today
                  </Button>
                  <Button variant="secondary" size="sm" aria-label="Previous" onPress={() => navigate({ date: shiftDate(view, date, -1) })}>
                    ‹
                  </Button>
                  <Button variant="secondary" size="sm" aria-label="Next" onPress={() => navigate({ date: shiftDate(view, date, 1) })}>
                    ›
                  </Button>
                  <h2 className="ml-1 text-base font-semibold text-foreground">{rangeLabel(view, date)}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    items={roomOptions}
                    value={roomFilter}
                    onChange={(value) => navigate({ room: value ?? "all" })}
                    placeholder="All rooms"
                    className="min-w-44"
                  />
                  <Tabs selectedKey={view} onSelectionChange={(key) => navigate({ view: parseConferenceView(String(key)) })}>
                    <Tabs.ListContainer>
                      <Tabs.List aria-label="Calendar view">
                        {CONFERENCE_VIEWS.map((v) => (
                          <Tabs.Tab key={v} id={v}>
                            {VIEW_LABEL[v]}
                            <Tabs.Indicator />
                          </Tabs.Tab>
                        ))}
                      </Tabs.List>
                    </Tabs.ListContainer>
                  </Tabs>
                </div>
              </div>

              {rooms.length > 1 ? (
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  {rooms.map((room) => (
                    <li key={room.id} className="flex items-center gap-1.5">
                      <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: roomColors.get(room.id) }} />
                      {room.status === "active" ? room.name : `${room.name} (removed)`}
                    </li>
                  ))}
                </ul>
              ) : null}

              {calendarBody}

              <p className="text-xs text-muted">
                {view === "month"
                  ? "Click a day to start a booking, or a date number to open that day. Switch to Day, Week or Timeline to stretch a meeting."
                  : "Click an empty slot to book it. Drag the edge of a meeting to stretch or contract it — it saves when you let go."}
              </p>
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="bookings" className="pt-4">
          <BookingsList
            bookings={bookings}
            roomColors={roomColors}
            onOpen={(b) => setSelectedId(b.id)}
            onCancel={(b) => setCancelTarget(b)}
          />
        </Tabs.Panel>

        <Tabs.Panel id="rooms" className="pt-4">
          <RoomsManager rooms={rooms} roomColors={roomColors} />
        </Tabs.Panel>
      </Tabs>

      {formState ? (
        <BookingFormModal
          key={formState.key}
          isOpen
          onClose={() => setFormState(null)}
          rooms={activeRooms}
          defaults={formState.defaults}
        />
      ) : null}

      <BookingDetailsDialog
        booking={selected}
        roomColor={selected ? roomColors.get(selected.roomId) : undefined}
        onClose={() => setSelectedId(null)}
        onCancel={(b) => {
          setSelectedId(null);
          setCancelTarget(b);
        }}
      />
      <CancelBookingDialog booking={cancelTarget} onClose={() => setCancelTarget(null)} />
      <ActionDialog
        isOpen={resizeError !== null}
        onOpenChange={(open) => !open && setResizeError(null)}
        heading="Couldn't change the booking"
        body={resizeError ? `${resizeError} The booking has been put back to its original time.` : null}
      />
    </div>
  );
}
