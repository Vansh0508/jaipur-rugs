"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, DateField, DatePicker, Input, Label, TextArea, TextField as HeroTextField } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";
import { Button, Modal, Select, TextField } from "@jaipur-rugs/ui-kit";
import { createConferenceBooking } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { todayInAppZone } from "@/lib/format";
import { findEmployeeByCode, type EmployeeByCode } from "@/lib/queries/employees";
import type { ConferenceRoom } from "@/lib/queries/conference";
import { fromTimeValue, istInstantMs, toTimeValue } from "@/lib/conference/calendar";
import { FieldError, LABEL_CLS, TimeInput } from "@/components/journeys/builder/fields";

// "Book Conference Room": Venue (a managed room), Booking Date (Hero UI DatePicker), From /
// To (Hero UI TimeFields), Employee ID — matched against the employees table as you type,
// which fills in the Employee name and Department (read-only: they come from the employee,
// they aren't typed) — Sitting Arrangement (a count), Event Name and Event Details.
// Remounted per open (callers change `key`), so the defaults — the slot that was clicked —
// are read once, on mount.

export interface BookingDefaults {
  roomId?: string;
  /** yyyy-mm-dd (IST). */
  date: string;
  startMin: number;
  endMin: number;
}

type Lookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found"; employee: EmployeeByCode }
  | { state: "notfound" }
  | { state: "inactive"; employee: EmployeeByCode }
  | { state: "error" };

export function BookingFormModal({
  isOpen,
  onClose,
  rooms,
  defaults,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Active rooms only — a removed room can't be booked. */
  rooms: ConferenceRoom[];
  defaults: BookingDefaults;
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState(defaults.roomId ?? rooms[0]?.id ?? "");
  const [date, setDate] = useState(defaults.date);
  const [from, setFrom] = useState(toTimeValue(defaults.startMin));
  const [to, setTo] = useState(toTimeValue(Math.min(defaults.endMin, 1439)));
  const [employeeCode, setEmployeeCode] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [seats, setSeats] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lookupToken = useRef(0);

  const room = rooms.find((r) => r.id === roomId);

  // Employee ID → employee: debounced lookup as the code is typed; a late response for an
  // older code is dropped (token) so a slow query can't overwrite a newer answer.
  useEffect(() => {
    const code = employeeCode.trim();
    const token = ++lookupToken.current;
    if (!code) {
      setLookup({ state: "idle" });
      return;
    }
    setLookup({ state: "loading" });
    const timer = setTimeout(async () => {
      try {
        const employee = await findEmployeeByCode(getBrowserSupabaseClient(), code);
        if (token !== lookupToken.current) return;
        setLookup(!employee ? { state: "notfound" } : employee.isActive ? { state: "found", employee } : { state: "inactive", employee });
      } catch {
        if (token === lookupToken.current) setLookup({ state: "error" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [employeeCode]);

  const employee = lookup.state === "found" || lookup.state === "inactive" ? lookup.employee : null;

  function validate(): string | null {
    if (!roomId) return "Choose a venue.";
    if (!date) return "Choose a booking date.";
    if (date < todayInAppZone()) return "The booking date can't be in the past.";
    if (!from || !to) return "Choose a from and to time.";
    if (fromTimeValue(to) <= fromTimeValue(from)) return "The 'to' time must be after the 'from' time.";
    if (!employeeCode.trim()) return "Enter the Employee ID.";
    if (lookup.state === "loading") return "Still looking up the Employee ID — one moment.";
    if (lookup.state !== "found") return lookup.state === "inactive" ? "That employee isn't active." : "No employee matches that Employee ID.";
    const count = Number(seats);
    if (!Number.isInteger(count) || count < 1) return "Enter the sitting arrangement as a whole number (1 or more).";
    if (room?.capacity && count > room.capacity) return `${room.name} seats ${room.capacity}.`;
    if (!eventName.trim()) return "Enter the event name.";
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (lookup.state !== "found") return;
    setSubmitting(true);
    setError(null);
    try {
      await createConferenceBooking(getBrowserSupabaseClient(), {
        roomId,
        employeeId: lookup.employee.id,
        startsAt: new Date(istInstantMs(date, fromTimeValue(from))).toISOString(),
        endsAt: new Date(istInstantMs(date, fromTimeValue(to))).toISOString(),
        seatingCount: Number(seats),
        eventName: eventName.trim(),
        eventDetails: eventDetails.trim() || undefined,
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book the room. Please try again.");
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
              <Modal.Heading>Book conference room</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit} noValidate>
              <Modal.Body className="flex flex-col gap-4">
                <Select
                  label="Venue"
                  items={rooms.map((r) => ({ id: r.id, label: r.capacity ? `${r.name} (seats ${r.capacity})` : r.name }))}
                  value={roomId || null}
                  onChange={(value) => value && setRoomId(value)}
                  placeholder={rooms.length === 0 ? "No conference rooms — add one first" : "Choose a venue"}
                  isRequired
                  fullWidth
                />

                <BookingDatePicker label="Booking date" value={date} onChange={setDate} min={todayInAppZone()} />

                <div className="grid grid-cols-2 gap-3">
                  <TimeInput label="From time" value={from} onChange={setFrom} />
                  <TimeInput label="To time" value={to} onChange={setTo} />
                </div>

                <div>
                  <TextField
                    label="Employee ID"
                    value={employeeCode}
                    onChange={setEmployeeCode}
                    placeholder="e.g. the employee's code"
                    isRequired
                    fullWidth
                  />
                  <LookupStatus lookup={lookup} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ReadOnlyField label="Employee name" value={employee?.fullName ?? ""} placeholder="Filled in from the Employee ID" />
                  <ReadOnlyField label="Department" value={employee ? (employee.departmentName ?? "—") : ""} placeholder="Filled in from the Employee ID" />
                </div>

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

                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting} isDisabled={rooms.length === 0}>
                  Book Conference Room
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function LookupStatus({ lookup }: { lookup: Lookup }) {
  if (lookup.state === "loading") return <p className="mt-1 text-xs text-muted">Looking up employee…</p>;
  if (lookup.state === "found") return <p className="mt-1 text-xs text-success">Employee found.</p>;
  if (lookup.state === "notfound") return <FieldError msg="No employee matches this ID." />;
  if (lookup.state === "inactive") return <FieldError msg="This employee isn't active, so a room can't be booked for them." />;
  if (lookup.state === "error") return <FieldError msg="Couldn't look up the employee. Try again." />;
  return null;
}

/** A value that comes from elsewhere (the employee) — shown, not typed. */
function ReadOnlyField({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
  return (
    <HeroTextField fullWidth isReadOnly value={value}>
      <Label>{label}</Label>
      <Input placeholder={placeholder} />
    </HeroTextField>
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
