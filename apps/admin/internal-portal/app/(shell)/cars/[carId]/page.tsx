import { notFound } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getCarById } from "@/lib/queries/cars";
import { listJourneysForCar } from "@/lib/queries/journeys";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { JourneyCard } from "@/components/journeys/JourneyCard";
import { CarStatusChip } from "@/components/cars/CarStatusChip";
import { CarStatusControls } from "@/components/cars/CarStatusControls";
import { QrCodeSlot } from "@/components/cars/QrCodeSlot";

export default async function CarDetailPage({ params }: { params: Promise<{ carId: string }> }) {
  const { carId } = await params;
  const supabase = await getServerSupabaseClient();
  const car = await getCarById(supabase, carId);
  if (!car) notFound();

  const [upcoming, past] = await Promise.all([
    listJourneysForCar(supabase, carId, { status: "upcoming" }),
    listJourneysForCar(supabase, carId, { status: "past" }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={car.name}
        description={`${car.model} — ${car.registration_number}`}
        action={<CarStatusControls vehicleId={car.id} status={car.status} />}
      />
      <div className="mb-8 flex items-center gap-3">
        <CarStatusChip status={car.status} />
      </div>

      <QrCodeSlot qrCodeUrl={car.qr_code_url} />

      <h2 className="mt-8 mb-3 text-sm font-semibold text-foreground">Upcoming journeys</h2>
      <div className="flex flex-col gap-3">
        {upcoming.length === 0 ? <EmptyState message="No upcoming journeys for this car." /> : upcoming.map((j) => <JourneyCard key={j.id} journey={j} />)}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-foreground">Past journeys</h2>
      <div className="flex flex-col gap-3">
        {past.length === 0 ? <EmptyState message="No past journeys for this car." /> : past.map((j) => <JourneyCard key={j.id} journey={j} />)}
      </div>
    </div>
  );
}
