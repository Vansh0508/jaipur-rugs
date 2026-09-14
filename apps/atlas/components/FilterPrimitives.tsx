"use client";

import { useState, useMemo } from "react";
import {
  Popover,
  Checkbox,
  SearchField,
  Label,
  DateRangePicker,
  DateField,
  RangeCalendar,
  type DateValue,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { ChevronDown, Xmark } from "@gravity-ui/icons";

export type FilterOption = { value: string; label: string };

/** Checkbox-style pill in dropdown for multi-select facet filters */
export function FacetDropdown({
  label,
  options,
  selected,
  onApply,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onApply: (values: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set(selected));
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function handleOpenChange(open: boolean) {
    if (open) {
      setPending(new Set(selected));
      setQuery("");
    } else {
      onApply(Array.from(pending));
    }
    setIsOpen(open);
  }

  function toggle(val: string) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(val)) {
        next.delete(val);
      } else {
        next.add(val);
      }
      return next;
    });
  }

  const isSelected = selected.length > 0;

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all select-none ${
            isSelected
              ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-xs"
              : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
          }`}
        >
          <span>{label}</span>
          {isSelected ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 dark:bg-black/25 px-1 text-[10px] font-bold">
              {selected.length}
            </span>
          ) : (
            <ChevronDown width={12} height={12} className="opacity-60" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="z-50 rounded-xl border border-border bg-surface p-3 shadow-xl">
        <Popover.Dialog className="flex w-64 flex-col gap-2.5 outline-none">
          <div className="flex items-center justify-between pb-1 border-b border-border/60">
            <span className="text-xs font-semibold text-foreground">{label}</span>
            {pending.size > 0 ? (
              <button
                type="button"
                onClick={() => setPending(new Set())}
                className="text-[11px] text-accent hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>

          {options.length > 6 ? (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground placeholder:text-muted outline-none focus:border-accent"
            />
          ) : null}

          <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto pr-1">
            {visible.length > 0 ? (
              visible.map((opt) => {
                const checked = pending.has(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs cursor-pointer select-none transition-colors ${
                      checked
                        ? "bg-neutral-100 dark:bg-neutral-800 text-foreground font-medium"
                        : "hover:bg-surface-secondary text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <Checkbox
                      isSelected={checked}
                      onChange={() => toggle(opt.value)}
                      aria-label={opt.label}
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })
            ) : (
              <p className="py-3 text-center text-xs text-muted">No matches</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
            <button
              type="button"
              onClick={() => {
                onApply(Array.from(pending));
                setIsOpen(false);
              }}
              className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
            >
              Apply
            </button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

/** Checkbox/radio style pill in dropdown for single-select filters */
export function SingleSelect({
  label,
  options,
  selected,
  onApply,
}: {
  label: string;
  options: FilterOption[];
  selected?: string;
  onApply: (value: string | undefined) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOpt = options.find((o) => o.value === selected);

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all select-none ${
            selected
              ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-xs"
              : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
          }`}
        >
          <span>{label}</span>
          {selectedOpt ? (
            <>
              <span className="font-semibold">: {selectedOpt.label}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onApply(undefined);
                }}
                className="hover:opacity-75"
              >
                <Xmark width={12} height={12} />
              </span>
            </>
          ) : (
            <ChevronDown width={12} height={12} className="opacity-60" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="z-50 rounded-xl border border-border bg-surface p-2 shadow-xl">
        <Popover.Dialog className="flex w-52 flex-col gap-1 outline-none">
          <button
            type="button"
            onClick={() => {
              onApply(undefined);
              setIsOpen(false);
            }}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
              !selected ? "bg-neutral-100 dark:bg-neutral-800 font-semibold text-foreground" : "hover:bg-surface-secondary text-muted"
            }`}
          >
            <span>Any</span>
            {!selected ? <span>✓</span> : null}
          </button>
          {options.map((opt) => {
            const active = opt.value === selected;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onApply(opt.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                  active ? "bg-neutral-100 dark:bg-neutral-800 font-semibold text-foreground" : "hover:bg-surface-secondary text-foreground"
                }`}
              >
                <span>{opt.label}</span>
                {active ? <span>✓</span> : null}
              </button>
            );
          })}
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

/** Hero UI DateRangePicker for Rev. Ex-Factory date range */
export function HeroDateRangePicker({
  startValue,
  endValue,
  onChange,
}: {
  startValue?: string;
  endValue?: string;
  onChange: (start: string | undefined, end: string | undefined) => void;
}) {
  const rangeValue = useMemo(() => {
    if (!startValue || !endValue) return null;
    try {
      return {
        start: parseDate(startValue),
        end: parseDate(endValue),
      };
    } catch {
      return null;
    }
  }, [startValue, endValue]);

  function handleRangeChange(val: { start: DateValue; end: DateValue } | null) {
    if (!val) {
      onChange(undefined, undefined);
      return;
    }
    const s = `${val.start.year}-${String(val.start.month).padStart(2, "0")}-${String(val.start.day).padStart(2, "0")}`;
    const e = `${val.end.year}-${String(val.end.month).padStart(2, "0")}-${String(val.end.day).padStart(2, "0")}`;
    onChange(s, e);
  }

  return (
    <div className="flex items-center gap-1.5">
      <DateRangePicker
        aria-label="Rev. Ex-Factory date range"
        value={rangeValue}
        onChange={handleRangeChange}
        className="w-64"
      >
        <Label className="sr-only">Rev. Ex-Factory Date Range</Label>
        <DateField.Group className="flex items-center rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:border-border-hover focus-within:border-accent shadow-xs h-8">
          <DateField.Input slot="start">
            {(segment) => <DateField.Segment segment={segment} className="text-xs" />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator className="px-1 text-xs text-muted">至</DateRangePicker.RangeSeparator>
          <DateField.Input slot="end">
            {(segment) => <DateField.Segment segment={segment} className="text-xs" />}
          </DateField.Input>
          <DateField.Suffix className="ml-auto pl-1">
            <DateRangePicker.Trigger className="text-muted hover:text-foreground">
              <DateRangePicker.TriggerIndicator />
            </DateRangePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DateRangePicker.Popover className="z-50 rounded-2xl border border-border bg-surface p-3 shadow-2xl">
          <RangeCalendar aria-label="Rev. Ex-Factory date calendar">
            <RangeCalendar.Header className="flex items-center justify-between pb-2 border-b border-border/60">
              <RangeCalendar.YearPickerTrigger className="text-xs font-semibold">
                <RangeCalendar.YearPickerTriggerHeading />
                <RangeCalendar.YearPickerTriggerIndicator />
              </RangeCalendar.YearPickerTrigger>
              <div className="flex items-center gap-1">
                <RangeCalendar.NavButton slot="previous" className="p-1 rounded hover:bg-surface-secondary text-xs" />
                <RangeCalendar.NavButton slot="next" className="p-1 rounded hover:bg-surface-secondary text-xs" />
              </div>
            </RangeCalendar.Header>
            <RangeCalendar.Grid className="w-full mt-2">
              <RangeCalendar.GridHeader>
                {(day) => <RangeCalendar.HeaderCell className="text-[11px] text-muted py-1 text-center font-medium">{day}</RangeCalendar.HeaderCell>}
              </RangeCalendar.GridHeader>
              <RangeCalendar.GridBody>
                {(date) => <RangeCalendar.Cell date={date} className="text-xs text-center p-0.5" />}
              </RangeCalendar.GridBody>
            </RangeCalendar.Grid>
            <RangeCalendar.YearPickerGrid className="w-full mt-2">
              <RangeCalendar.YearPickerGridBody>
                {({ year }) => <RangeCalendar.YearPickerCell year={year} className="text-xs text-center p-1" />}
              </RangeCalendar.YearPickerGridBody>
            </RangeCalendar.YearPickerGrid>
          </RangeCalendar>
        </DateRangePicker.Popover>
      </DateRangePicker>
      {startValue || endValue ? (
        <button
          type="button"
          onClick={() => onChange(undefined, undefined)}
          title="Clear dates"
          className="text-muted hover:text-foreground p-1 transition-colors"
        >
          <Xmark width={12} height={12} />
        </button>
      ) : null}
    </div>
  );
}

/** Hero UI SearchField for orders search */
export function HeroSearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
}: {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return (
    <SearchField
      name="search"
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onClear={onClear}
      aria-label="Search orders"
      className="flex items-center"
    >
      <Label className="sr-only">Search</Label>
      <SearchField.Group className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs hover:border-border-hover focus-within:border-accent shadow-xs h-8">
        <SearchField.SearchIcon className="w-3.5 h-3.5 text-muted shrink-0" />
        <SearchField.Input
          className="w-[180px] sm:w-[240px] bg-transparent text-xs text-foreground placeholder:text-muted outline-none"
          placeholder="Search OTN, item, merchant…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSubmit();
            }
          }}
        />
        <SearchField.ClearButton className="text-muted hover:text-foreground text-xs" />
      </SearchField.Group>
    </SearchField>
  );
}
