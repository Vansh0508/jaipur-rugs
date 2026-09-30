import Link from "next/link";
import { Card } from "@heroui/react";
import { StarRating } from "@jaipur-rugs/ui-kit";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listJourneys } from "@/lib/queries/journeys";
import { listCarsWithActivity } from "@/lib/queries/cars";
import { listDriversWithStats } from "@/lib/queries/drivers";
import { listPendingFeedback, listRecentFeedback } from "@/lib/queries/feedback";
import { driverStatusCounts, getRideCountsByDay, vehicleStatusCounts } from "@/lib/queries/dashboard";
import { EmptyState } from "@/components/shared/EmptyState";
import { DashboardPendingReviews } from "@/components/drivers/DashboardPendingReviews";
import { JourneysTabsCard } from "@/components/dashboard/JourneysTabsCard";
import { RideCountsChart } from "@/components/dashboard/RideCountsChart";
import { StatusPieCard } from "@/components/dashboard/StatusPieCard";

const RIDE_DAYS = 14;

// Slice colours carry meaning (good / needs attention / out), so they're Hero UI status
// tokens rather than the chart palette — both themes follow the app.
const OK = "var(--success)";
const ATTENTION = "var(--warning)";
const OUT = "var(--muted)";

export default async function DashboardPage() {
  const supabase = await getServerSupabaseClient();

  const [active, upcoming, rideCounts, drivers, cars, recentFeedback, pendingFeedback] = await Promise.all([
    listJourneys(supabase, { status: "ongoing" }),
    listJourneys(supabase, { status: "planned" }),
    getRideCountsByDay(supabase, RIDE_DAYS),
    listDriversWithStats(supabase),
    listCarsWithActivity(supabase),
    listRecentFeedback(supabase, 5),
    listPendingFeedback(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <RideCountsChart data={rideCounts} days={RIDE_DAYS} />
        <StatusPieCard
          title="Drivers"
          counts={driverStatusCounts(drivers)}
          colors={[OK, ATTENTION, OUT]}
          note="Busy = on a journey right now. Inactive includes drivers on leave or suspended."
          emptyMessage="No drivers yet."
        />
        <StatusPieCard
          title="Vehicles"
          counts={vehicleStatusCounts(cars)}
          colors={[OK, ATTENTION, OUT]}
          note="Active includes cars out on a journey. Under maintenance includes accidental."
          emptyMessage="No vehicles yet."
        />
      </div>

      <JourneysTabsCard active={active} upcoming={upcoming} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Title>Recent reviews</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            {recentFeedback.length === 0 ? (
              <EmptyState message="No reviews yet." />
            ) : (
              recentFeedback.map((f) => (
                <div key={f.id} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{f.driverName}</span>
                    <StarRating value={f.rating} isReadOnly size={16} />
                  </div>
                  {f.description ? <p className="text-sm text-muted">{f.description}</p> : null}
                </div>
              ))
            )}
          </Card.Content>
          <Card.Footer>
            <Link href="/drivers" className="text-sm font-medium text-accent hover:underline">
              View drivers
            </Link>
          </Card.Footer>
        </Card>

        {/* Unplanned-ride reviews don't count toward a driver's rating until approved. Keyed on
            the pending ids so the client list resets when the server's queue changes. */}
        <DashboardPendingReviews key={pendingFeedback.map((f) => f.id).join(",")} reviews={pendingFeedback} />
      </div>
    </div>
  );
}
