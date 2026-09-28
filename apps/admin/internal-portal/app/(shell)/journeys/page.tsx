import Link from "next/link";
import { buttonVariants } from "@heroui/react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getDefaultJourneyRange, listJourneys } from "@/lib/queries/journeys";
import { listCars } from "@/lib/queries/cars";
import { listDrivers } from "@/lib/queries/drivers";
import { parseListView } from "@/lib/listView";
import { PageHeader } from "@/components/shared/PageHeader";
import { JourneysListClient } from "@/components/journeys/JourneysListClient";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function JourneysPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; range?: string; view?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getServerSupabaseClient();

  // ?range=all → every journey; explicit ?from=&to= → that window; neither → the default
  // (today, widened to cover all upcoming/in-progress journeys — see getDefaultJourneyRange).
  const range =
    params.range === "all"
      ? null
      : params.from && params.to && DATE_PATTERN.test(params.from) && DATE_PATTERN.test(params.to)
        ? { from: params.from, to: params.to }
        : await getDefaultJourneyRange(supabase);

  const [journeys, cars, drivers] = await Promise.all([
    listJourneys(supabase, range ?? {}),
    listCars(supabase),
    listDrivers(supabase),
  ]);

  return (
    <div>
      <PageHeader
        title="Journeys"
        action={
          <Link href="/journeys/new" className={buttonVariants()}>
            New journey
          </Link>
        }
      />
      <JourneysListClient
        journeys={journeys}
        cars={cars.map((c) => ({ id: c.id, label: `${c.registration_number} — ${c.name}` }))}
        drivers={drivers.map((d) => ({ id: d.id, label: d.full_name }))}
        range={range}
        view={parseListView(params.view)}
      />
    </div>
  );
}
