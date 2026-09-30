import { notFound } from "next/navigation";
import { Breadcrumbs } from "@heroui/react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getDriverListItemById } from "@/lib/queries/drivers";
import { listJourneysForDriver } from "@/lib/queries/journeys";
import { listFeedbackForDriver } from "@/lib/queries/feedback";
import { DriverDetailView } from "@/components/drivers/DriverDetailView";

export default async function DriverDetailPage({ params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const supabase = await getServerSupabaseClient();
  const driver = await getDriverListItemById(supabase, driverId);
  if (!driver) notFound();

  const [journeys, feedback] = await Promise.all([
    listJourneysForDriver(supabase, driverId),
    listFeedbackForDriver(supabase, driverId),
  ]);
  // Filtered on the derived displayStatus rather than the query's time-based "past":
  // that would drop a journey ended early via Mark ended (last_drop_at still in the
  // future) and include cancelled ones whose window has passed.
  const completed = journeys.filter((journey) => journey.displayStatus === "completed");

  return (
    <div>
      <Breadcrumbs className="mb-2">
        <Breadcrumbs.Item href="/drivers">Drivers</Breadcrumbs.Item>
        <Breadcrumbs.Item>{driver.full_name}</Breadcrumbs.Item>
      </Breadcrumbs>
      <DriverDetailView driver={driver} feedback={feedback} completedJourneys={completed} />
    </div>
  );
}
