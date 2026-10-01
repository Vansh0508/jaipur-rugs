import Link from "next/link";
import { buttonVariants } from "@heroui/react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getDefaultJourneyRange, listJourneys } from "@/lib/queries/journeys";
import { listCars } from "@/lib/queries/cars";
import { listDrivers } from "@/lib/queries/drivers";
import { parseListView } from "@/lib/listView";
import { PageHeader } from "@/components/shared/PageHeader";
import { JourneysListClient } from "@/components/journeys/JourneysListClient";
import { RequestsPanel } from "@/components/requests/RequestsPanel";
import { listPendingJourneyRequests, requestsOrEmpty } from "@/lib/queries/bookingRequests";

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

  const [journeys, cars, drivers, requests] = await Promise.all([
    listJourneys(supabase, range ?? {}),
    listCars(supabase),
    listDrivers(supabase),
    requestsOrEmpty(listPendingJourneyRequests(supabase)),
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
      {/* Only while something is waiting — the list below is the page's main job. */}
      {requests.length > 0 ? (
        <div className="mb-6">
          <RequestsPanel
            requests={requests}
            title="Journey requests"
            description="Journeys employees have asked for. Approving assigns a car and driver and plans the journey."
          />
        </div>
      ) : null}
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
