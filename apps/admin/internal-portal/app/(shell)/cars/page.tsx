import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listCarsWithActivity } from "@/lib/queries/cars";
import { parseListView } from "@/lib/listView";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ViewToggle } from "@/components/shared/ViewToggle";
import { CarCard } from "@/components/cars/CarCard";
import { CarsTable } from "@/components/cars/CarsTable";
import { AddCarAction } from "@/components/cars/AddCarAction";

export default async function CarsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = parseListView((await searchParams).view);
  const supabase = await getServerSupabaseClient();
  const cars = await listCarsWithActivity(supabase);

  return (
    <div>
      <PageHeader
        title="Cars"
        action={
          <div className="flex items-center gap-3">
            <ViewToggle view={view} />
            <AddCarAction />
          </div>
        }
      />
      {cars.length === 0 ? (
        <EmptyState message="No cars yet." />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      ) : (
        <CarsTable cars={cars} />
      )}
    </div>
  );
}
