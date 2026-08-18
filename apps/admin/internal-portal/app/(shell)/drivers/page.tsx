import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listDrivers } from "@/lib/queries/drivers";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { DriverCard } from "@/components/drivers/DriverCard";
import { AddDriverAction } from "@/components/drivers/AddDriverAction";

export default async function DriversPage() {
  const supabase = await getServerSupabaseClient();
  const drivers = await listDrivers(supabase);

  return (
    <div>
      <PageHeader title="Drivers" action={<AddDriverAction />} />
      {drivers.length === 0 ? (
        <EmptyState message="No drivers yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {drivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}
    </div>
  );
}
