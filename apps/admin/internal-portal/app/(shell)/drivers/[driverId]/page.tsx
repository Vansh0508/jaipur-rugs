import { notFound } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getDriverById } from "@/lib/queries/drivers";
import { listJourneysForDriver } from "@/lib/queries/journeys";
import { listPlannedFeedbackForDriver, listPendingFeedbackForDriver } from "@/lib/queries/feedback";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { JourneyCard } from "@/components/journeys/JourneyCard";
import { PlannedFeedbackList } from "@/components/drivers/PlannedFeedbackList";
import { UnplannedFeedbackApprovalList } from "@/components/drivers/UnplannedFeedbackApprovalList";
import { resolvePhotoUrl } from "@/lib/env";

export default async function DriverDetailPage({ params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const supabase = await getServerSupabaseClient();
  const driver = await getDriverById(supabase, driverId);
  if (!driver) notFound();

  const [upcoming, past, plannedFeedback, pendingFeedback] = await Promise.all([
    listJourneysForDriver(supabase, driverId, { status: "upcoming" }),
    listJourneysForDriver(supabase, driverId, { status: "past" }),
    listPlannedFeedbackForDriver(supabase, driverId),
    listPendingFeedbackForDriver(supabase, driverId),
  ]);

  const photoUrl = resolvePhotoUrl(driver.photo_path);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={driver.full_name} description={driver.driver_code} />
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, not a static asset
        <img src={photoUrl} alt={driver.full_name} className="mb-8 size-20 rounded-full object-cover" />
      ) : null}

      <h2 className="mb-3 text-sm font-semibold text-foreground">Upcoming rides</h2>
      <div className="mb-8 flex flex-col gap-3">
        {upcoming.length === 0 ? <EmptyState message="No upcoming rides." /> : upcoming.map((j) => <JourneyCard key={j.id} journey={j} />)}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Completed rides</h2>
      <div className="mb-8 flex flex-col gap-3">
        {past.length === 0 ? <EmptyState message="No completed rides yet." /> : past.map((j) => <JourneyCard key={j.id} journey={j} />)}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Reviews — planned rides</h2>
      <div className="mb-8">
        <PlannedFeedbackList feedback={plannedFeedback} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Reviews — unplanned rides, pending approval</h2>
      <UnplannedFeedbackApprovalList feedback={pendingFeedback} />
    </div>
  );
}
