"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DateField as HeroDateField,
  DateRangePicker,
  ListBox,
  RangeCalendar,
  SearchField,
  Select,
  buttonVariants,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";
import { Button, Pagination } from "@jaipur-rugs/ui-kit";
import type { JourneySummary } from "@/lib/queries/journeys";
import type { JourneyStatus } from "@/lib/journeyStatus";
import type { ListView } from "@/lib/listView";
import { ViewToggle } from "@/components/shared/ViewToggle";
import { EmptyState } from "@/components/shared/EmptyState";
import { JourneyRouteCard } from "./JourneyRouteCard";
import { JourneysTable } from "./JourneysTable";

const PAGE_SIZE = 12;

const STATUS_OPTIONS: { id: JourneyStatus | "all"; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "ongoing", label: "Ongoing" },
  { id: "planned", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

// In-progress first, then upcoming, then the rest; newest first within each —
// driver-app-new's "active first, then by date" grid order.
const STATUS_RANK: Record<JourneyStatus, number> = { ongoing: 0, planned: 1, completed: 2, cancelled: 3 };

interface Option {
  id: string;
  label: string;
}

/**
 * driver-app-new's JourneysListClient: one filter bar (search, status, car, driver, date
 * range) over a card grid or table, 12 per page. Split the same way the rest of this app
 * is: the date range lives in the URL (?from=&to=, or ?range=all) because it's what the
 * Server Component actually fetches by; search/status/car/driver narrow that result
 * in-memory here, like driver-app-new's own search box did. The view uses the app's shared
 * ?view= toggle (table default — the app-wide convention for list pages).
 */
export function JourneysListClient({
  journeys,
  cars,
  drivers,
  range,
  view,
}: {
  journeys: JourneySummary[];
  cars: Option[];
  drivers: Option[];
  range: { from: string; to: string } | null;
  view: ListView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<JourneyStatus | "all">("all");
  const [carId, setCarId] = useState("all");
  const [driverId, setDriverId] = useState("all");
  const [page, setPage] = useState(1);

  // Any filter change goes back to page 1 (also when the server hands over a new range).
  useEffect(() => setPage(1), [search, status, carId, driverId, journeys]);

  function setRange(next: { from: string; to: string } | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    params.delete("range");
    if (next) {
      params.set("from", next.from);
      params.set("to", next.to);
    } else {
      params.set("range", "all");
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return journeys
      .filter((j) => status === "all" || j.displayStatus === status)
      .filter((j) => carId === "all" || j.vehicleId === carId)
      .filter((j) => driverId === "all" || j.driverId === driverId)
      .filter(
        (j) =>
          !q ||
          j.stops.some((s) => s.locationName.toLowerCase().includes(q)) ||
          (j.driverName ?? "").toLowerCase().includes(q) ||
          (j.plate ?? "").toLowerCase().includes(q) ||
          (j.carName ?? "").toLowerCase().includes(q) ||
          j.guests.some((g) => g.name.toLowerCase().includes(q) || g.phone.includes(q)),
      )
      .sort((a, b) => STATUS_RANK[a.displayStatus] - STATUS_RANK[b.displayStatus] || b.firstPickupAt.localeCompare(a.firstPickupAt));
  }, [journeys, search, status, carId, driverId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <SearchField aria-label="Search journeys" value={search} onChange={setSearch} className="min-w-[10rem] flex-1 sm:w-52 sm:flex-none">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search route, driver, plate, guest…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <FilterSelect ariaLabel="Filter by status" options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus(v as JourneyStatus | "all")} />
        <FilterSelect ariaLabel="Filter by car" options={[{ id: "all", label: "All cars" }, ...cars]} value={carId} onChange={setCarId} />
        <FilterSelect ariaLabel="Filter by driver" options={[{ id: "all", label: "All drivers" }, ...drivers]} value={driverId} onChange={setDriverId} />

        <I18nProvider locale="en-GB">
          <DateRangePicker
            aria-label="Filter by date range"
            className="min-w-[15rem] flex-1 sm:w-[290px] sm:flex-none"
            value={range ? { start: parseDate(range.from), end: parseDate(range.to) } : null}
            onChange={(next) => setRange(next ? { from: next.start.toString(), to: next.end.toString() } : null)}
          >
            <HeroDateField.Group>
              <HeroDateField.Input slot="start">{(segment) => <HeroDateField.Segment segment={segment} />}</HeroDateField.Input>
              <DateRangePicker.RangeSeparator />
              <HeroDateField.Input slot="end">{(segment) => <HeroDateField.Segment segment={segment} />}</HeroDateField.Input>
              <HeroDateField.Suffix>
                <DateRangePicker.Trigger>
                  <DateRangePicker.TriggerIndicator />
                </DateRangePicker.Trigger>
              </HeroDateField.Suffix>
            </HeroDateField.Group>
            <DateRangePicker.Popover>
              <RangeCalendar aria-label="Journey dates">
                <RangeCalendar.Header>
                  <RangeCalendar.YearPickerTrigger>
                    <RangeCalendar.YearPickerTriggerHeading />
                    <RangeCalendar.YearPickerTriggerIndicator />
                  </RangeCalendar.YearPickerTrigger>
                  <RangeCalendar.NavButton slot="previous" />
                  <RangeCalendar.NavButton slot="next" />
                </RangeCalendar.Header>
                <RangeCalendar.Grid>
                  <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
                  <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
                </RangeCalendar.Grid>
                <RangeCalendar.YearPickerGrid>
                  <RangeCalendar.YearPickerGridBody>{({ year }) => <RangeCalendar.YearPickerCell year={year} />}</RangeCalendar.YearPickerGridBody>
                </RangeCalendar.YearPickerGrid>
              </RangeCalendar>
            </DateRangePicker.Popover>
          </DateRangePicker>
        </I18nProvider>
        {range ? (
          <Button variant="ghost" size="sm" onPress={() => setRange(null)}>
            All dates
          </Button>
        ) : null}

        <div className="ml-auto">
          <ViewToggle view={view} />
        </div>
      </div>

      <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <EmptyState message="No journeys match your filters." />
            <Link href="/journeys/new" className={buttonVariants({ size: "sm" })}>
              New journey
            </Link>
          </div>
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((j) => (
              <JourneyRouteCard key={j.id} journey={j} />
            ))}
          </div>
        ) : (
          <JourneysTable journeys={pageRows} />
        )}
      </div>

      {pageCount > 1 ? (
        <div className="flex justify-center">
          <Pagination size="sm">
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous isDisabled={page <= 1} onPress={() => setPage(page - 1)}>
                  Previous
                </Pagination.Previous>
              </Pagination.Item>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <Pagination.Item key={n}>
                  <Pagination.Link isActive={n === page} onPress={() => setPage(n)}>
                    {n}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next isDisabled={page >= pageCount} onPress={() => setPage(page + 1)}>
                  Next
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select aria-label={ariaLabel} value={value} onChange={(key) => onChange(key == null ? "all" : String(key))} className="min-w-[8rem] flex-1 sm:w-40 sm:flex-none">
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox className="max-h-72 overflow-y-auto">
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
