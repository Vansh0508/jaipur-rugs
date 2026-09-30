"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Tabs } from "@heroui/react";
import type { JourneySummary } from "@/lib/queries/journeys";
import { formatDate, formatTime } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DETAIL_PAGE_SIZE, PaginationBar } from "@/components/shared/PaginationBar";
import { JourneyStatusChip } from "@/components/journeys/JourneyStatusChip";

// Dashboard journeys: Active and Upcoming as two Hero UI secondary tabs, each a primary-
// variant table (the app's shared DataTable) with its own pager. Replaces the two 5-row
// card lists — every active/upcoming journey is reachable here, and a row opens it.

function whenLabel(journey: JourneySummary) {
  const startDate = formatDate(journey.firstPickupAt);
  const endDate = formatDate(journey.lastDropAt);
  const start = `${startDate} · ${formatTime(journey.firstPickupAt)}`;
  return startDate === endDate ? `${start} – ${formatTime(journey.lastDropAt)}` : `${start} → ${endDate} · ${formatTime(journey.lastDropAt)}`;
}

const COLUMNS: DataTableColumn<JourneySummary>[] = [
  {
    id: "when",
    label: "When",
    isRowHeader: true,
    render: (journey) => <span className="whitespace-nowrap text-sm font-medium text-foreground">{whenLabel(journey)}</span>,
  },
  {
    id: "route",
    label: "Route",
    render: (journey) => (
      <p className="max-w-xs truncate text-sm text-muted" title={journey.routeSummary}>
        {journey.routeSummary || "Route not set"}
      </p>
    ),
  },
  {
    id: "car",
    label: "Car",
    render: (journey) => (
      <div className="min-w-0">
        <p className="text-sm text-foreground tabular-nums">{journey.plate ?? "—"}</p>
        {journey.carName ? <p className="truncate text-xs text-muted">{journey.carName}</p> : null}
      </div>
    ),
  },
  {
    id: "driver",
    label: "Driver",
    render: (journey) => <span className="text-sm text-foreground">{journey.driverName ?? "—"}</span>,
  },
  {
    id: "guests",
    label: "Guests",
    render: (journey) => <span className="text-sm text-muted tabular-nums">{journey.guestCount}</span>,
  },
  {
    id: "status",
    label: "Status",
    render: (journey) => <JourneyStatusChip status={journey.displayStatus} />,
  },
];

function JourneysTable({ journeys, ariaLabel, emptyMessage }: { journeys: JourneySummary[]; ariaLabel: string; emptyMessage: string }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(journeys.length / DETAIL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  return (
    <div>
      <DataTable
        ariaLabel={ariaLabel}
        columns={COLUMNS}
        rows={journeys.slice((currentPage - 1) * DETAIL_PAGE_SIZE, currentPage * DETAIL_PAGE_SIZE)}
        getRowId={(journey) => journey.id}
        rowHref={(journey) => `/journeys/${journey.id}`}
        emptyMessage={emptyMessage}
      />
      <PaginationBar page={currentPage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

export function JourneysTabsCard({ active, upcoming }: { active: JourneySummary[]; upcoming: JourneySummary[] }) {
  // Soonest first for upcoming (the query is newest-first, right for active, wrong here).
  const upcomingSoonest = [...upcoming].sort((a, b) => a.firstPickupAt.localeCompare(b.firstPickupAt));

  return (
    <Card>
      <Card.Content>
        <Tabs variant="secondary" defaultSelectedKey="active">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Journeys">
              <Tabs.Tab id="active">
                Active journeys ({active.length})
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="upcoming">
                Upcoming journeys ({upcoming.length})
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="active" className="pt-4">
            <JourneysTable journeys={active} ariaLabel="Active journeys" emptyMessage="No journeys are active right now." />
          </Tabs.Panel>
          <Tabs.Panel id="upcoming" className="pt-4">
            <JourneysTable journeys={upcomingSoonest} ariaLabel="Upcoming journeys" emptyMessage="No upcoming journeys planned." />
          </Tabs.Panel>
        </Tabs>
      </Card.Content>
      <Card.Footer>
        <Link href="/journeys" className="text-sm font-medium text-accent hover:underline">
          View all journeys
        </Link>
      </Card.Footer>
    </Card>
  );
}
