import { notFound } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getJourneyById } from "@/lib/queries/journeys";
import { PageHeader } from "@/components/shared/PageHeader";
import { JourneyStatusChip } from "@/components/journeys/JourneyStatusChip";
import { CancelJourneyButton } from "@/components/journeys/CancelJourneyButton";

export default async function JourneyDetailPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await params;
  const supabase = await getServerSupabaseClient();
  const journey = await getJourneyById(supabase, journeyId);
  if (!journey) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={journey.dateFrom === journey.dateTo ? journey.dateFrom : `${journey.dateFrom} – ${journey.dateTo}`}
        description={journey.routeSummary}
        action={journey.status !== "cancelled" && journey.status !== "completed" ? <CancelJourneyButton journeyId={journey.id} /> : null}
      />
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted">
        <JourneyStatusChip status={journey.status} />
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
            <p className="text-sm text-muted">{new Date(stop.arrivalAt).toLocaleString()}</p>
            {stop.pickups.length > 0 ? <p className="mt-1 text-sm text-success">Picks up: {stop.pickups.join(", ")}</p> : null}
            {stop.drops.length > 0 ? <p className="mt-1 text-sm text-warning">Drops off: {stop.drops.join(", ")}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
