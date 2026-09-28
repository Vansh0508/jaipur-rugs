import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listDriversWithStats } from "@/lib/queries/drivers";
import { parseListView } from "@/lib/listView";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ViewToggle } from "@/components/shared/ViewToggle";
import { DriverCard } from "@/components/drivers/DriverCard";
import { DriversTable } from "@/components/drivers/DriversTable";
import { AddDriverAction } from "@/components/drivers/AddDriverAction";

export default async function DriversPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = parseListView((await searchParams).view);
  const supabase = await getServerSupabaseClient();
  const drivers = await listDriversWithStats(supabase);

  return (
    <div>
      <PageHeader
        title="Drivers"
        action={
          <div className="flex items-center gap-3">
            <ViewToggle view={view} />
            <AddDriverAction />
          </div>
        }
      />
      {drivers.length === 0 ? (
        <EmptyState message="No drivers yet." />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {drivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      ) : (
        <DriversTable drivers={drivers} />
      )}
    </div>
  );
}
