import Link from "next/link";
import { buttonVariants } from "@heroui/react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listJourneys } from "@/lib/queries/journeys";
import { JourneyCard } from "@/components/journeys/JourneyCard";
import { JourneyFilters } from "@/components/journeys/JourneyFilters";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Enums } from "@jaipur-rugs/supabase-client";

const TAB_TO_STATUS: Record<string, Enums<"journey_status"> | undefined> = {
  active: "ongoing",
  upcoming: "planned",
  completed: "completed",
};

export default async function JourneysPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getServerSupabaseClient();

  const journeys = await listJourneys(supabase, {
    status: params.tab ? TAB_TO_STATUS[params.tab] : undefined,
    from: params.from,
    to: params.to,
  });

  return (
    <div>
      <PageHeader
        title="Journeys"
        action={
          <Link href="/journeys/new" className={buttonVariants()}>
            Plan new journey
          </Link>
        }
      />
      <JourneyFilters />
      <div className="flex flex-col gap-3">
        {journeys.length === 0 ? (
          <EmptyState message="No journeys match this filter." />
        ) : (
          journeys.map((j) => <JourneyCard key={j.id} journey={j} variant="detailed" />)
        )}
      </div>
    </div>
  );
}
