"use client";

import { useState } from "react";
import { Accordion, Chip } from "@heroui/react";
import { Button, StarRating } from "@jaipur-rugs/ui-kit";
import { approveFeedback } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { FeedbackRow } from "@/lib/queries/feedback";
import { formatDate } from "@/lib/format";

// Review rows for the driver detail page, ported from driver-app-new's DriverFeedbackView:
// the "Unverified Reviews" moderation card (Acknowledge / Suspend there → Approve / Reject
// here, via the approve-feedback Edge Function) and the accordion row for a counted review
// (journey-linked "Journey review" vs unplanned-but-approved "Direct review").

function ReviewerAvatar({ name, tone }: { name: string; tone: "neutral" | "warning" }) {
  return (
    <div
      aria-hidden
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase ${
        tone === "warning" ? "bg-warning/15 text-warning" : "bg-surface-secondary text-muted"
      }`}
    >
      {name.charAt(0)}
    </div>
  );
}

export function ReviewTypeChip({ isJourneyReview }: { isJourneyReview: boolean }) {
  return (
    <Chip size="sm" variant="soft" color={isJourneyReview ? "accent" : "default"}>
      <Chip.Label className="text-[10px]">{isJourneyReview ? "Journey review" : "Direct review"}</Chip.Label>
    </Chip>
  );
}

export function PendingReviewCard({
  review,
  onDecided,
}: {
  review: FeedbackRow;
  onDecided: (review: FeedbackRow, decision: "approved" | "rejected") => void;
}) {
  const [deciding, setDeciding] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setDeciding(decision);
    setError(null);
    try {
      await approveFeedback(getBrowserSupabaseClient(), { feedbackId: review.id, decision });
      onDecided(review, decision);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record decision.");
      setDeciding(null);
    }
  }

  return (
    <div className="rounded-xl border border-warning/40 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ReviewerAvatar name={review.reviewerName} tone="warning" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{review.reviewerName}</p>
            {review.reviewerPhone ? <p className="text-xs text-muted">{review.reviewerPhone}</p> : null}
            <p className="text-[10px] text-muted">Travelled {formatDate(review.travelDate)}</p>
          </div>
        </div>
        <StarRating value={review.rating} isReadOnly size={16} />
      </div>

      {review.description ? (
        <p className="mt-3 rounded-lg border border-border bg-surface-secondary/40 px-3 py-2 text-xs italic text-muted">
          &ldquo;{review.description}&rdquo;
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <Button size="sm" isPending={deciding === "approved"} isDisabled={deciding !== null} onPress={() => decide("approved")}>
          Approve
        </Button>
        <Button size="sm" variant="danger" isPending={deciding === "rejected"} isDisabled={deciding !== null} onPress={() => decide("rejected")}>
          Reject
        </Button>
      </div>
    </div>
  );
}

export function ReviewAccordionItem({ review }: { review: FeedbackRow }) {
  return (
    <Accordion.Item
      id={review.id}
      className="overflow-hidden rounded-xl border border-border bg-surface transition-shadow data-[expanded=true]:shadow-sm"
    >
      <Accordion.Heading>
        <Accordion.Trigger className="flex w-full items-center justify-between gap-3 p-4 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <ReviewerAvatar name={review.reviewerName} tone="neutral" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{review.reviewerName}</p>
                <ReviewTypeChip isJourneyReview={review.journeyId !== null} />
              </div>
              <p className="mt-0.5 text-[10px] text-muted">{formatDate(review.createdAt)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StarRating value={review.rating} isReadOnly size={14} />
            <Accordion.Indicator className="text-muted" />
          </div>
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="border-t border-border bg-surface-secondary/30 p-4 text-xs">
          {review.description ? (
            <p className="rounded-lg border border-border bg-surface p-3 italic text-foreground">&ldquo;{review.description}&rdquo;</p>
          ) : (
            <p className="italic text-muted">No comments provided.</p>
          )}
          <p className="mt-2 text-[10px] text-muted">
            Travelled {formatDate(review.travelDate)}
            {review.reviewerKind ? ` · ${review.reviewerKind === "employee" ? "Employee" : "Guest"}` : ""}
          </p>
        </Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
