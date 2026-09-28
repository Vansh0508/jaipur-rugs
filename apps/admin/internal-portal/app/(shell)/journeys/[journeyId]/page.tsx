import { notFound } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getJourneyById } from "@/lib/queries/journeys";
import { PageHeader } from "@/components/shared/PageHeader";
import { JourneyStatusChip } from "@/components/journeys/JourneyStatusChip";
import { CancelJourneyButton } from "@/components/journeys/CancelJourneyButton";
import { MarkEndedButton } from "@/components/journeys/MarkEndedButton";
import { formatDate, formatTime } from "@/lib/format";

export default async function JourneyDetailPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await params;
  const supabase = await getServerSupabaseClient();
  const journey = await getJourneyById(supabase, journeyId);
  if (!journey) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={
          formatDate(journey.firstPickupAt) === formatDate(journey.lastDropAt)
            ? formatDate(journey.firstPickupAt)
            : `${formatDate(journey.firstPickupAt)} – ${formatDate(journey.lastDropAt)}`
        }
        description={journey.routeSummary}
        action={
          // Upcoming → cancel; in progress → end (cancel-journey still allows either, but
          // "cancel" on a trip that's under way reads wrong — driver-app-new only offered End).
          journey.displayStatus === "planned" ? (
            <CancelJourneyButton journeyId={journey.id} />
          ) : journey.displayStatus === "ongoing" ? (
            <MarkEndedButton journeyId={journey.id} />
          ) : null
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted">
        <JourneyStatusChip status={journey.displayStatus} />
        {journey.carLabel ? <span>{journey.carLabel}</span> : null}
        {journey.driverLabel ? <span>{journey.driverLabel}</span> : null}
        <span>{journey.guestCount} guest{journey.guestCount === 1 ? "" : "s"}</span>
      </div>
      {journey.notes ? <p className="mb-6 text-sm text-muted">{journey.notes}</p> : null}

      <h2 className="mb-3 text-sm font-semibold text-foreground">Route</h2>
      <ol className="flex flex-col gap-3">
        {journey.stops.map((stop) => (
          <li key={stop.sequenceNo} className="rounded-lg border-2 border-border p-3">
            <p className="text-sm font-medium">{stop.locationName}</p>
            <p className="text-sm text-muted">
              {formatDate(stop.arrivalAt)} · {formatTime(stop.arrivalAt)}
            </p>
            {stop.pickups.length > 0 ? <p className="mt-1 text-sm text-success">Picks up: {stop.pickups.map((g) => g.name).join(", ")}</p> : null}
            {stop.drops.length > 0 ? <p className="mt-1 text-sm text-warning">Drops off: {stop.drops.map((g) => g.name).join(", ")}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
