"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@heroui/react";
import { Button, Select } from "@jaipur-rugs/ui-kit";
import { formatTime, todayInAppZone } from "@/lib/format";
import {
  CONFERENCE_VIEWS,
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
import { RequestSentDialog } from "@/components/shared/RequestSentDialog";
import { MonthGrid } from "./MonthGrid";
import { RequestFormModal, type RequestDefaults } from "./RequestFormModal";
import { TimeGrid, type SlotSelection } from "./TimeGrid";
import { TimelineView } from "./TimelineView";

// The employee side of conference booking: the admin's calendar (apps/admin/internal-portal
// ConferenceWorkspace) — Day / Week / Month / Timeline, the room filter, the room legend, the
// view and date in the URL — showing when each room is already taken (no names), where
// clicking a free slot opens a request for it. No Bookings or Rooms tabs: those manage real
// bookings, which only admins do.

const VIEW_LABEL: Record<ConferenceView, string> = { day: "Day", week: "Week", month: "Month", timeline: "Timeline" };

/** The next half hour (or 9 AM when that's before the working day) for "Request" with no slot picked. */
function defaultSlot(date: string): { startMin: number; endMin: number } {
  if (date === todayInAppZone()) {
    const nowIst = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
    const [h, m] = nowIst.split(":").map(Number);
    const startMin = Math.min(22 * 60, Math.ceil(((h ?? 0) * 60 + (m ?? 0) + 1) / 30) * 30);
    if (startMin >= 9 * 60) return { startMin, endMin: startMin + 60 };
  }
  return { startMin: 9 * 60, endMin: 10 * 60 };
}

export function ConferenceRequestWorkspace({
  rooms,
  busy,
  view,
  date,
  roomFilter,
  loadError,
}: {
  rooms: ConferenceRoom[];
  /** Busy blocks around the visible range. */
  busy: ConferenceBooking[];
  view: ConferenceView;
  date: string;
  roomFilter: string;
  /** Set when availability couldn't be loaded. */
  loadError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [formState, setFormState] = useState<{ key: number; defaults: RequestDefaults } | null>(null);
  const [takenSlot, setTakenSlot] = useState<ConferenceBooking | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  const roomColors = useMemo(() => roomColorMap(rooms), [rooms]);
  const calendarBusy = useMemo(() => (roomFilter === "all" ? busy : busy.filter((b) => b.roomId === roomFilter)), [busy, roomFilter]);
  const timelineRooms = useMemo(() => (roomFilter === "all" ? rooms : rooms.filter((r) => r.id === roomFilter)), [rooms, roomFilter]);

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

  function openForm(defaults: RequestDefaults) {
    setFormState((prev) => ({ key: (prev?.key ?? 0) + 1, defaults }));
  }

  function openBlankForm() {
    const target = date < todayInAppZone() ? todayInAppZone() : date;
    openForm({ roomId: roomFilter !== "all" ? roomFilter : undefined, date: target, ...defaultSlot(target) });
  }

  function handleCreate(slot: SlotSelection & { roomId?: string }) {
    openForm({ roomId: slot.roomId ?? (roomFilter !== "all" ? roomFilter : undefined), date: slot.date, startMin: slot.startMin, endMin: slot.endMin });
  }

  const today = todayInAppZone();
  const roomOptions = [{ id: "all", label: "All rooms" }, ...rooms.map((r) => ({ id: r.id, label: r.name }))];
  const noop = () => {};

  let calendarBody: React.ReactNode;
  if (view === "month") {
    calendarBody = (
      <MonthGrid
        date={date}
        bookings={calendarBusy}
        roomColors={roomColors}
        onSelect={setTakenSlot}
        onCreate={(day) => handleCreate({ date: day, startMin: 9 * 60, endMin: 10 * 60 })}
        onOpenDay={(day) => navigate({ view: "day", date: day })}
      />
    );
  } else if (view === "timeline") {
    calendarBody = (
      <TimelineView date={date} rooms={timelineRooms} bookings={calendarBusy} roomColors={roomColors} onSelect={setTakenSlot} onCreate={handleCreate} onResize={noop} />
    );
  } else {
    calendarBody = (
      <TimeGrid
        dates={view === "week" ? weekDates(date) : [date]}
        bookings={calendarBusy}
        roomColors={roomColors}
        showRoomName={roomFilter === "all"}
        onSelect={setTakenSlot}
        onCreate={handleCreate}
        onResize={noop}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Conference booking"
        description="See when the conference rooms are free and request one. The admin team approves every request before the room is booked."
        action={
          <Button onPress={openBlankForm} isDisabled={rooms.length === 0}>
            Request conference room
          </Button>
        }
      />

      {loadError ? (
        <EmptyState message={`Couldn't load the rooms: ${loadError}`} />
      ) : rooms.length === 0 ? (
        <EmptyState message="There are no conference rooms to book yet." />
      ) : (
        <div className="flex flex-col gap-4">
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
              <Select items={roomOptions} value={roomFilter} onChange={(value) => navigate({ room: value ?? "all" })} placeholder="All rooms" className="min-w-44" />
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
                  {room.name}
                  {room.capacity ? ` (seats ${room.capacity})` : ""}
                </li>
              ))}
            </ul>
          ) : null}

          {calendarBody}

          <p className="text-xs text-muted">
            {view === "month"
              ? "Click a day to request a room that day, or a date number to open it. Coloured blocks are times a room is already booked."
              : "Click an empty slot to request it. Coloured blocks are times a room is already booked."}
          </p>
        </div>
      )}

      {formState ? (
        <RequestFormModal
          key={formState.key}
          isOpen
          onClose={() => setFormState(null)}
          onSent={(id) => {
            setFormState(null);
            setSentId(id);
          }}
          rooms={rooms}
          busy={busy}
          defaults={formState.defaults}
        />
      ) : null}

      <ActionDialog
        isOpen={takenSlot !== null}
        onOpenChange={(open) => !open && setTakenSlot(null)}
        heading="That time is taken"
        body={
          takenSlot
            ? `${takenSlot.roomName} is booked ${formatTime(takenSlot.startsAt)} – ${formatTime(takenSlot.endsAt)}. Pick a free slot, or another room.`
            : null
        }
      />
      <RequestSentDialog
        isOpen={sentId !== null}
        onClose={() => setSentId(null)}
        heading="Request sent"
        body="The admin team will review your request. The room is only booked once they approve it."
        reference={sentId}
      />
    </div>
  );
}
