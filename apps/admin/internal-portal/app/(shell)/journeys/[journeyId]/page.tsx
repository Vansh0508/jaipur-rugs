import { notFound } from "next/navigation";
import { Breadcrumbs } from "@heroui/react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getJourneyById } from "@/lib/queries/journeys";
import { listFeedbackForJourney } from "@/lib/queries/feedback";
import { JourneyStatusChip } from "@/components/journeys/JourneyStatusChip";
import { JourneyTimeline } from "@/components/journeys/JourneyTimeline";
import { CancelJourneyButton } from "@/components/journeys/CancelJourneyButton";
import { MarkEndedButton } from "@/components/journeys/MarkEndedButton";
import { formatDate } from "@/lib/format";

// Journey record page, ported from driver-app-new's journeys/[id]/page.tsx: breadcrumb,
// "start → end" title with date · driver · plate · status, the actions, then the
// JourneyTimeline (guests, feedback, route). It fills the page width — no centred
// max-width column. driver-app-new's Edit button isn't carried over: this app has no
// journey-edit flow, only cancel (upcoming) and end (in progress).

export default async function JourneyDetailPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await params;
  const supabase = await getServerSupabaseClient();
  const journey = await getJourneyById(supabase, journeyId);
  if (!journey) notFound();

  // Feedback is only shown for a finished trip; a failed read shouldn't take the page down.
  const feedback = journey.displayStatus === "completed" ? await listFeedbackForJourney(supabase, journeyId).catch(() => []) : [];

  const origin = journey.stops.find((s) => s.role === "origin")?.locationName ?? "—";
  const destination = journey.stops.find((s) => s.role === "destination")?.locationName ?? "—";
  const dates =
    formatDate(journey.firstPickupAt) === formatDate(journey.lastDropAt)
      ? formatDate(journey.firstPickupAt)
      : `${formatDate(journey.firstPickupAt)} – ${formatDate(journey.lastDropAt)}`;

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs className="mb-1">
            <Breadcrumbs.Item href="/journeys">Journeys</Breadcrumbs.Item>
            <Breadcrumbs.Item>Detail</Breadcrumbs.Item>
          </Breadcrumbs>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {origin} → {destination}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{dates}</span>
            {journey.driverLabel ? (
              <>
                <span>·</span>
                <span>{journey.driverLabel}</span>
              </>
            ) : null}
            {journey.plate ? (
              <>
                <span>·</span>
                <span className="tabular-nums tracking-wide">{journey.plate}</span>
              </>
            ) : null}
            <JourneyStatusChip status={journey.displayStatus} />
          </div>
        </div>

        {/* Upcoming → cancel; in progress → end (cancel-journey still allows either, but
            "cancel" on a trip that's under way reads wrong — driver-app-new only offered End). */}
        {journey.displayStatus === "planned" ? (
          <CancelJourneyButton journeyId={journey.id} />
        ) : journey.displayStatus === "ongoing" ? (
          <MarkEndedButton journeyId={journey.id} />
        ) : null}
      </div>

      {journey.notes ? <p className="mb-6 text-sm text-muted">{journey.notes}</p> : null}

      <JourneyTimeline journey={journey} feedback={feedback} />
    </div>
  );
}
