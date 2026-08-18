import type { InputHTMLAttributes } from "react";

export interface DateRangeValue {
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
}

export interface DateRangeFieldProps {
  label?: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  isRequired?: boolean;
  className?: string;
  startInputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange">;
  endInputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange">;
}

/**
 * Two plain native `<input type="date">`s (from/to), styled to match `DateField`.
 * Deliberately not Hero UI's `DateRangePicker`/`RangeCalendar` compound — those need the
 * `@internationalized/date` CalendarDate conversion, which is unwarranted complexity for
 * internal-portal's use (a same-day-friendly trip-window scope, not calendar-UI browsing).
 * `DateField`'s own comment reserves this exact case ("revisit only if a second app needs
 * calendar-range picking") — this is that second app, and native inputs still cover it.
 */
export function DateRangeField({
  label,
  value,
  onChange,
  isRequired,
  className,
  startInputProps,
  endInputProps,
}: DateRangeFieldProps) {
  const inputClassName =
    "h-11 rounded-lg border-2 border-border bg-transparent px-3 text-sm outline-none transition-colors focus:border-accent";

  return (
    <div className={"flex flex-col gap-1.5 " + (className ?? "")}>
      {label ? <span className="text-sm font-medium text-foreground">{label}</span> : null}
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label="From date"
          required={isRequired}
          className={inputClassName}
          value={value.start}
          max={value.end || undefined}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
          {...startInputProps}
        />
        <span className="text-sm text-muted">to</span>
        <input
          type="date"
          aria-label="To date"
          required={isRequired}
          className={inputClassName}
          value={value.end}
          min={value.start || undefined}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          {...endInputProps}
        />
      </div>
    </div>
  );
}
