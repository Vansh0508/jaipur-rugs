import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { resolvePhotoUrl } from "@/lib/env";
import { DriverGrid, type Driver } from "@/components/DriverGrid";

export default async function DriversPage() {
  // Plain RLS-scoped read via the shared client — reads never go through db-management,
  // only writes do (AGENTS.md Section 4/9).
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from("drivers")
    .select("id, full_name, photo_path")
    .eq("status", "active")
    .order("full_name");

  if (error) {
    throw new Error(`Failed to load drivers: ${error.message}`);
  }

  const drivers: Driver[] = (data ?? []).map((row) => ({
    id: row.id as string,
    fullName: row.full_name as string,
    photoUrl: resolvePhotoUrl(row.photo_path as string | null),
  }));

  return (
    <main className="min-h-screen px-4 py-10 sm:px-[20%]">
      <h1 className="mb-8 text-2xl font-semibold">Rate your driver</h1>
      <DriverGrid drivers={drivers} />
    </main>
  );
}
