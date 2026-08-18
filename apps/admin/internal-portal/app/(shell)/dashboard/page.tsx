import Link from "next/link";
import { Card } from "@heroui/react";
import { StarRating } from "@jaipur-rugs/ui-kit";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listJourneys } from "@/lib/queries/journeys";
import { listRecentFeedback } from "@/lib/queries/feedback";
import { JourneyCard } from "@/components/journeys/JourneyCard";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function DashboardPage() {
  const supabase = await getServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const [active, upcoming, recentFeedback] = await Promise.all([
    listJourneys(supabase, { status: "ongoing" }),
    listJourneys(supabase, { status: "planned", from: today }),
    listRecentFeedback(supabase, 5),
  ]);

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
            <Link href="/journeys?tab=active" className="text-sm font-medium text-accent hover:underline">
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
            <Link href="/journeys?tab=upcoming" className="text-sm font-medium text-accent hover:underline">
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
      </div>
    </div>
  );
}
