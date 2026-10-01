"use client";

import { useState } from "react";
import { Calendar, DateField, DatePicker, Label, TextArea, TextField as HeroTextField } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";
import { Button, Modal, Select, TextField } from "@jaipur-rugs/ui-kit";
import { requestConferenceBooking } from "@jaipur-rugs/db-management-client";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { todayInAppZone } from "@/lib/format";
import type { ConferenceBooking, ConferenceRoom } from "@/lib/queries/conference";
import { fromTimeValue, hasStarted, istInstantMs, toTimeValue } from "@/lib/conference/calendar";
import { LABEL_CLS, TimeInput } from "@/components/journey/fields";
import { EmployeeCodeField, lookupProblem, useEmployeeLookup, useRememberedEmployeeCode } from "@/components/shared/EmployeeCodeField";

// "Request conference room" — the admin's Book Conference Room form (apps/admin/internal-portal
// BookingFormModal), field for field: Venue, Booking date, From / To, Employee ID (yours — it
// fills in your name and department), Sitting arrangement, Event name and details. Sending it
// creates a request, not a booking: an Internal Portal admin approves it, and only then is the
// room held. A slot that's already taken is refused here before it's sent (and again by the
// server). Remounted per open (callers change `key`), so the clicked slot is read once.

export interface RequestDefaults {
  roomId?: string;
  /** yyyy-mm-dd (IST). */
  date: string;
  startMin: number;
  endMin: number;
}

export function RequestFormModal({
  isOpen,
  onClose,
  onSent,
  rooms,
  busy,
  defaults,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSent: (requestId: string) => void;
  rooms: ConferenceRoom[];
  /** Busy blocks already loaded, for the up-front "that slot is taken" check. */
  busy: ConferenceBooking[];
  defaults: RequestDefaults;
}) {
  const [roomId, setRoomId] = useState(defaults.roomId ?? rooms[0]?.id ?? "");
  const [date, setDate] = useState(defaults.date);
  const [from, setFrom] = useState(toTimeValue(defaults.startMin));
  const [to, setTo] = useState(toTimeValue(Math.min(defaults.endMin, 1439)));
  const [employeeCode, setEmployeeCode, rememberCode] = useRememberedEmployeeCode();
  const lookup = useEmployeeLookup(employeeCode);
  const [seats, setSeats] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const room = rooms.find((r) => r.id === roomId);

  function validate(): string | null {
    if (!roomId) return "Choose a venue.";
    if (!date) return "Choose a booking date.";
    if (date < todayInAppZone()) return "The booking date can't be in the past.";
    if (!from || !to) return "Choose a from and to time.";
    if (fromTimeValue(to) <= fromTimeValue(from)) return "The 'to' time must be after the 'from' time.";
    if (hasStarted(date, fromTimeValue(from))) return "That start time has already passed — pick a time from now on.";
    const who = lookupProblem(lookup, employeeCode);
    if (who) return who;
    const count = Number(seats);
    if (!Number.isInteger(count) || count < 1) return "Enter the sitting arrangement as a whole number (1 or more).";
    if (room?.capacity && count > room.capacity) return `${room.name} seats ${room.capacity}.`;
    if (!eventName.trim()) return "Enter the event name.";
    const start = istInstantMs(date, fromTimeValue(from));
    const end = istInstantMs(date, fromTimeValue(to));
    const taken = busy.some((b) => b.roomId === roomId && new Date(b.startsAt).getTime() < end && new Date(b.endsAt).getTime() > start);
    if (taken) return `${room?.name ?? "This room"} is already booked for part of that time. Pick a free slot.`;
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await requestConferenceBooking(getSupabaseClient(), {
        employeeCode: employeeCode.trim(),
        roomId,
        startsAt: new Date(istInstantMs(date, fromTimeValue(from))).toISOString(),
        endsAt: new Date(istInstantMs(date, fromTimeValue(to))).toISOString(),
        seatingCount: Number(seats),
        eventName: eventName.trim(),
        eventDetails: eventDetails.trim() || undefined,
      });
      rememberCode();
      onSent(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="sm:max-w-[560px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Request conference room</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit} noValidate>
              <Modal.Body className="flex flex-col gap-4">
                <Select
                  label="Venue"
                  items={rooms.map((r) => ({ id: r.id, label: r.capacity ? `${r.name} (seats ${r.capacity})` : r.name }))}
                  value={roomId || null}
                  onChange={(value) => value && setRoomId(value)}
                  placeholder={rooms.length === 0 ? "No conference rooms yet" : "Choose a venue"}
                  isRequired
                  fullWidth
                />
                {room?.description ? (
                  // Where the chosen room is (conference_rooms.description).
                  <p className="-mt-2 text-xs text-muted">
                    <span className="font-medium text-foreground">Location:</span> {room.description}
                  </p>
                ) : null}

                <BookingDatePicker label="Booking date" value={date} onChange={setDate} min={todayInAppZone()} />

                <div className="grid grid-cols-2 gap-3">
                  <TimeInput label="From time" value={from} onChange={setFrom} />
                  <TimeInput label="To time" value={to} onChange={setTo} />
                </div>

                <EmployeeCodeField code={employeeCode} onChange={setEmployeeCode} lookup={lookup} />

                <TextField
                  label={room?.capacity ? `Sitting arrangement (max ${room.capacity})` : "Sitting arrangement"}
                  value={seats}
                  onChange={setSeats}
                  type="number"
                  placeholder="Number of seats"
                  isRequired
                  fullWidth
                />

                <TextField label="Event name" value={eventName} onChange={setEventName} isRequired fullWidth />

                <HeroTextField fullWidth value={eventDetails} onChange={setEventDetails}>
                  <Label>Event details</Label>
                  <TextArea rows={3} placeholder="Agenda, attendees, anything the room needs set up (optional)" />
                </HeroTextField>

                <p className="text-xs text-muted">This sends a request. The room is only booked once the admin team approves it.</p>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting} isDisabled={rooms.length === 0}>
                  Send request
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Hero UI DatePicker (segments + calendar popover), stacked label, `yyyy-mm-dd` in and out. */
function BookingDatePicker({ label, value, onChange, min }: { label: string; value: string; onChange: (value: string) => void; min: string }) {
  return (
    <I18nProvider locale="en-GB">
      <DatePicker
        className="w-full"
        value={value ? parseDate(value) : null}
        minValue={parseDate(min)}
        onChange={(next) => onChange(next ? next.toString() : "")}
      >
        <Label className={LABEL_CLS}>{label}</Label>
        <DateField.Group fullWidth>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label={label}>
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  );
}
