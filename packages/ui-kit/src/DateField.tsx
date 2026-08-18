"use client";

import {
  Calendar,
  DateField as HeroDateField,
  DatePicker as HeroDatePicker,
  Label,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";

export interface DateFieldProps {
  label?: string;
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
  max?: string; // yyyy-mm-dd
  min?: string; // yyyy-mm-dd
  className?: string;
}

/**
 * Hero UI v3's actual DatePicker (DateField segments + Calendar popover), not a native
 * `<input type="date">`. Wrapped so call sites keep working with plain `yyyy-mm-dd`
 * strings — DatePicker itself speaks `@internationalized/date`'s `CalendarDate`.
 */
export function DateField({ label, value, onChange, max, min, className }: DateFieldProps) {
  return (
    // en-GB orders DateField's segments dd/mm/yyyy (still the Gregorian calendar — only
    // the segment order changes, not the underlying date values or ISO string format).
    <I18nProvider locale="en-GB">
      <HeroDatePicker
        // Overrides the component's default `flex-col` (label stacked above the field)
        // with a single row: label on the left, the field pinned to the right.
        className={`flex-row items-center justify-between gap-3 ${className ?? ""}`.trim()}
        value={value ? parseDate(value) : null}
        maxValue={max ? parseDate(max) : undefined}
        minValue={min ? parseDate(min) : undefined}
        onChange={(next) => onChange(next ? next.toString() : "")}
      >
        {label ? <Label className="shrink-0">{label}</Label> : null}
        <HeroDateField.Group>
          <HeroDateField.Input>{(segment) => <HeroDateField.Segment segment={segment} />}</HeroDateField.Input>
          <HeroDateField.Suffix>
            <HeroDatePicker.Trigger>
              <HeroDatePicker.TriggerIndicator />
            </HeroDatePicker.Trigger>
          </HeroDateField.Suffix>
        </HeroDateField.Group>
        <HeroDatePicker.Popover>
          <Calendar aria-label={label ?? "Choose date"}>
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
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </HeroDatePicker.Popover>
      </HeroDatePicker>
    </I18nProvider>
  );
}
