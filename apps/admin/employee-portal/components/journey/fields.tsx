"use client";

import { useState } from "react";
import { Calendar, DateField, DatePicker, Label, ListBox, TimeField, type Selection } from "@heroui/react";
import { Time, parseDateTime } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";
import { Popover } from "@jaipur-rugs/ui-kit";
import type { PoolGuest } from "./model";

// Small pieces of driver-app-new's JourneyBuilder, on Hero UI v3 + this app's tokens.

export function SectionHeading({ label, letter }: { label: string; letter: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{letter}</span>
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
    </div>
  );
}

export function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-danger">{msg}</p> : null;
}

export const LABEL_CLS = "mb-1.5 block text-sm font-medium text-foreground";

/** Date + time (12h), value as "yyyy-MM-ddTHH:mm" local time. */
export function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  let parsed;
  try {
    parsed = value ? parseDateTime(value) : null;
  } catch {
    parsed = null;
  }
  return (
    <I18nProvider locale="en-GB">
      <DatePicker
        className="w-full"
        granularity="minute"
        hourCycle={12}
        value={parsed}
        onChange={(next) => next && onChange(next.toString().slice(0, 16))}
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

/** Small "Employee" marker next to a passenger name (guests are the default, unmarked). */
export function PassengerKindTag() {
  return (
    <span className="shrink-0 rounded bg-accent/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-accent">Employee</span>
  );
}

/** Time of day (12h), value as "HH:mm" (24h) or "". */
export function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [h, m] = value ? value.split(":").map(Number) : [];
  return (
    <TimeField
      className="w-full"
      hourCycle={12}
      value={value ? new Time(h, m) : null}
      onChange={(t) => onChange(t ? `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}` : "")}
    >
      <Label className={LABEL_CLS}>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      </DateField.Group>
    </TimeField>
  );
}

/**
 * driver-app-new's MultiGuestSelect: a button summarizing the selection, opening a
 * multi-select list. Open state is controlled so Escape can be caught *before* the
 * ListBox sees it — React Aria's ListBox clears the whole selection on Escape by default
 * (and swallows the key, so the popover wouldn't even close).
 */
export function MultiGuestSelect({
  guests,
  selectedIds,
  onChange,
  placeholder,
}: {
  guests: PoolGuest[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const selected = guests.filter((g) => selectedIds.includes(g.clientId));
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      {/* The Trigger is itself the button (a React Aria pressable) — no inner <button>, which would nest one button in another. */}
      <Popover.Trigger
        aria-label={selected.length === 0 ? placeholder : `${placeholder} ${selected.length} selected`}
        className="flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 text-left text-sm outline-none focus-visible:border-accent"
      >
        <span className={`truncate ${selected.length === 0 ? "text-muted" : "text-foreground"}`}>
          {selected.length === 0 ? placeholder : selected.map((g) => g.name || g.phone).join(", ")}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Popover.Trigger>
      <Popover.Content placement="bottom start">
        <Popover.Dialog className="max-h-64 w-72 overflow-y-auto p-1">
          <div
            onKeyDownCapture={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }
            }}
          >
          {guests.length === 0 ? (
            <p className="p-2 text-center text-xs text-muted">No guests available here. Add guests to the pool first.</p>
          ) : (
            <ListBox
              aria-label={placeholder}
              selectionMode="multiple"
              selectedKeys={new Set(selectedIds)}
              onSelectionChange={(keys: Selection) =>
                onChange(keys === "all" ? guests.map((g) => g.clientId) : (Array.from(keys) as string[]))
              }
            >
              {guests.map((g) => (
                <ListBox.Item key={g.clientId} id={g.clientId} textValue={g.name || g.phone}>
                  <div className="flex w-full min-w-0 items-center justify-between gap-4">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm">{g.name || "Unnamed guest"}</span>
                      {g.kind === "employee" ? <PassengerKindTag /> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">{g.kind === "employee" ? g.employeeCode : g.phone}</span>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          )}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
