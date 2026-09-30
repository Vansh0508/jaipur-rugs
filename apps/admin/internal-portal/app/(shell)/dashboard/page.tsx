import Link from "next/link";
import { Card } from "@heroui/react";
import { StarRating } from "@jaipur-rugs/ui-kit";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listJourneys } from "@/lib/queries/journeys";
import { listPendingFeedback, listRecentFeedback } from "@/lib/queries/feedback";
import { formatDate } from "@/lib/format";
import { JourneyCard } from "@/components/journeys/JourneyCard";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function DashboardPage() {
  const supabase = await getServerSupabaseClient();

  const [active, upcoming, recentFeedback, pendingFeedback] = await Promise.all([
    listJourneys(supabase, { status: "ongoing" }),
    listJourneys(supabase, { status: "planned" }),
    listRecentFeedback(supabase, 5),
    listPendingFeedback(supabase),
  ]);
  const PENDING_SHOWN = 6;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Dashboard</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Title>Active journeys</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            {active.length === 0 ? (
              <EmptyState message="No journeys are active right now." />
            ) : (
              active.slice(0, 5).map((j) => <JourneyCard key={j.id} journey={j} variant="compact" />)
            )}
          </Card.Content>
          <Card.Footer>
            <Link href="/journeys" className="text-sm font-medium text-accent hover:underline">
              View all
            </Link>
          </Card.Footer>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Upcoming journeys</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            {upcoming.length === 0 ? (
              <EmptyState message="No upcoming journeys planned." />
            ) : (
              upcoming.slice(0, 5).map((j) => <JourneyCard key={j.id} journey={j} variant="compact" />)
            )}
          </Card.Content>
          <Card.Footer>
            <Link href="/journeys" className="text-sm font-medium text-accent hover:underline">
              View all
            </Link>
          </Card.Footer>
        </Card>

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

        {/* Unplanned-ride reviews don't count toward a driver's rating until approved — this
            is the queue across all drivers; each row opens that driver, where Approve /
            Reject live (DriverDetailView). Full-width so a long queue reads as a grid. */}
        <Card className="lg:col-span-3">
          <Card.Header className="flex items-center gap-2">
            <Card.Title>Unverified reviews</Card.Title>
            {pendingFeedback.length > 0 ? (
              <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">{pendingFeedback.length}</span>
            ) : null}
          </Card.Header>
          <Card.Content>
            {pendingFeedback.length === 0 ? (
              <EmptyState message="No reviews are waiting for approval." />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pendingFeedback.slice(0, PENDING_SHOWN).map((f) => (
                  <Link
                    key={f.id}
                    href={`/drivers/${f.driverId}`}
                    className="flex flex-col gap-1.5 rounded-xl border border-warning/40 bg-warning/5 p-3 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{f.driverName}</span>
                      <StarRating value={f.rating} isReadOnly size={14} />
                    </div>
                    <p className="text-xs text-muted">
                      {f.reviewerName} · {formatDate(f.createdAt)}
                    </p>
                    {f.description ? <p className="line-clamp-2 text-sm text-muted">{f.description}</p> : null}
                  </Link>
                ))}
              </div>
            )}
          </Card.Content>
          {pendingFeedback.length > 0 ? (
            <Card.Footer className="flex items-center justify-between">
              <span className="text-xs text-muted">
                {pendingFeedback.length > PENDING_SHOWN
                  ? `Showing ${PENDING_SHOWN} of ${pendingFeedback.length} — open a driver to approve or reject.`
                  : "Open a driver to approve or reject."}
              </span>
              <Link href="/drivers" className="text-sm font-medium text-accent hover:underline">
                View drivers
              </Link>
            </Card.Footer>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
