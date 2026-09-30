"use client";

import { useMemo, useState } from "react";
import { Accordion } from "@heroui/react";
import type { DriverListItem } from "@/lib/queries/drivers";
import type { FeedbackRow } from "@/lib/queries/feedback";
import type { JourneySummary } from "@/lib/queries/journeys";
import { EmptyState } from "@/components/shared/EmptyState";
import { DETAIL_PAGE_SIZE, PaginationBar } from "@/components/shared/PaginationBar";
import { JourneyRouteCard } from "@/components/journeys/JourneyRouteCard";
import { DriverActionsMenu } from "./DriverActionsMenu";
import { DriverAvatar } from "./DriverAvatar";
import { DriverStatusChip } from "./DriverStatusChip";
import { PendingReviewCard, ReviewAccordionItem, ReviewTypeChip } from "./DriverReviewItems";

// Driver detail ported from driver-app-new's DriverFeedbackView: identity header, a
// rating/reviews/rides summary strip, the "Unverified Reviews" moderation queue (only when
// there are pending ones), one merged Driver Reviews accordion (journey-linked + direct,
// newest first, 10/page) and a paginated Completed Journeys grid. Approving a pending
// review moves it into the accordion and recomputes the average/count here, without a
// round-trip; rejecting just drops it.

function Stat({ value, label, tone }: { value: string | number; label: string; tone?: "warning" }) {
  return (
    <div className="text-center">
      <p className={`text-4xl font-semibold tabular-nums ${tone === "warning" ? "text-warning" : "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

const Divider = () => <div className="h-10 w-px bg-border" />;

export function DriverDetailView({
  driver,
  feedback,
  completedJourneys,
}: {
  driver: DriverListItem;
  feedback: FeedbackRow[];
  completedJourneys: JourneySummary[];
}) {
  // Rejected reviews never show; approved count toward the rating; pending wait for a decision.
  const [approved, setApproved] = useState(() => feedback.filter((f) => f.reviewStatus === "approved"));
  const [pending, setPending] = useState(() => feedback.filter((f) => f.reviewStatus === "pending"));
  const [reviewsPage, setReviewsPage] = useState(1);
  const [ridesPage, setRidesPage] = useState(1);

  const avgRating = useMemo(
    () => (approved.length === 0 ? null : Math.round((approved.reduce((sum, r) => sum + r.rating, 0) / approved.length) * 10) / 10),
    [approved],
  );

  function handleDecided(review: FeedbackRow, decision: "approved" | "rejected") {
    setPending((prev) => prev.filter((r) => r.id !== review.id));
    if (decision === "approved") {
      setApproved((prev) =>
        [{ ...review, reviewStatus: "approved" as const }, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    }
  }

  const pagedReviews = approved.slice((reviewsPage - 1) * DETAIL_PAGE_SIZE, reviewsPage * DETAIL_PAGE_SIZE);
  const pagedRides = completedJourneys.slice((ridesPage - 1) * DETAIL_PAGE_SIZE, ridesPage * DETAIL_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-8">
      {/* Identity header */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <DriverAvatar fullName={driver.full_name} photoPath={driver.photo_path} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-foreground">{driver.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted tabular-nums">
                {driver.driver_code}
              </span>
              <span className="text-sm text-muted">{driver.phone}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <DriverStatusChip status={driver.displayStatus} />
          <DriverActionsMenu driver={driver} />
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface px-4 py-4 shadow-sm sm:gap-8 sm:px-8 sm:py-6">
        <Stat value={avgRating !== null ? avgRating.toFixed(1) : "—"} label="avg rating" />
        <Divider />
        <Stat value={approved.length} label={approved.length === 1 ? "review" : "reviews"} />
        <Divider />
        <Stat value={completedJourneys.length} label={completedJourneys.length === 1 ? "completed ride" : "completed rides"} />
        {pending.length > 0 ? (
          <>
            <Divider />
            <Stat value={pending.length} label="pending" tone="warning" />
          </>
        ) : null}
      </div>

      {/* Unverified reviews */}
      {pending.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-warning/40 bg-warning/5 p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">Unverified reviews</h2>
            <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">{pending.length}</span>
            <span className="text-xs text-muted">— awaiting admin action</span>
          </div>
          <p className="text-xs text-muted">
            These reviews were submitted for an unplanned ride, so no journey record backs them up. Approve to count the rating;
            Reject to discard.
          </p>
          <div className="flex flex-col gap-3">
            {pending.map((review) => (
              <PendingReviewCard key={review.id} review={review} onDecided={handleDecided} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Driver reviews */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-secondary/40 p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">Driver reviews</h2>
          <div className="flex gap-2">
            <ReviewTypeChip isJourneyReview />
            <ReviewTypeChip isJourneyReview={false} />
          </div>
        </div>
        {approved.length === 0 ? (
          <EmptyState message="No reviews yet." />
        ) : (
          <div>
            <Accordion className="flex flex-col gap-3">
              {pagedReviews.map((review) => (
                <ReviewAccordionItem key={review.id} review={review} />
              ))}
            </Accordion>
            <PaginationBar page={reviewsPage} pageCount={Math.ceil(approved.length / DETAIL_PAGE_SIZE)} onPageChange={setReviewsPage} />
          </div>
        )}
      </section>

      {/* Completed journeys */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-secondary/40 p-6">
        <h2 className="text-lg font-bold text-foreground">Completed journeys</h2>
        {completedJourneys.length === 0 ? (
          <EmptyState message="No completed journeys yet." />
        ) : (
          <div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pagedRides.map((journey) => (
                <JourneyRouteCard key={journey.id} journey={journey} />
              ))}
            </div>
            <PaginationBar page={ridesPage} pageCount={Math.ceil(completedJourneys.length / DETAIL_PAGE_SIZE)} onPageChange={setRidesPage} />
          </div>
        )}
      </section>
    </div>
  );
}
