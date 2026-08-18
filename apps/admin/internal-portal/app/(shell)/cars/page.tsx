import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listCars } from "@/lib/queries/cars";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { CarCard } from "@/components/cars/CarCard";
import { AddCarAction } from "@/components/cars/AddCarAction";

export default async function CarsPage() {
  const supabase = await getServerSupabaseClient();
  const cars = await listCars(supabase);

  return (
    <div>
      <PageHeader title="Cars" action={<AddCarAction />} />
      {cars.length === 0 ? (
        <EmptyState message="No cars yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      )}
    </div>
  );
}
