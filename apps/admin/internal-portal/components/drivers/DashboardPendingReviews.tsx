"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@heroui/react";
import { StarRating } from "@jaipur-rugs/ui-kit";
import { approveFeedback } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { FeedbackRow } from "@/lib/queries/feedback";
import { formatDate } from "@/lib/format";
import { ActionsMenu, type ActionSection } from "@/components/shared/ActionsMenu";
import { ActionDialog } from "@/components/shared/ActionDialog";
import { AvailableIcon, DeactivateIcon, ViewIcon } from "@/components/shared/icons";
import { EmptyState } from "@/components/shared/EmptyState";

// Dashboard "Unverified reviews" card: the pending queue across all drivers, with the same
// ⋮ quick-action menu + confirm dialog pattern as the cars/drivers lists (ActionsMenu /
// ActionDialog, same icons) so a review can be approved or rejected right from here. The
// whole tile still opens the driver (stretched link), like CarCard. The full list is kept
// in state and sliced for display, so deciding one pulls the next pending review in.

const SHOWN = 6;

type Decision = "approved" | "rejected";

const SECTIONS: ActionSection[] = [
  { id: "general", items: [{ id: "view", label: "View driver", icon: ViewIcon }] },
  {
    id: "decision",
    title: "Decision",
    items: [
      { id: "approved", label: "Approve", icon: AvailableIcon, description: "Counts toward the driver's rating" },
      { id: "rejected", label: "Reject", icon: DeactivateIcon, variant: "danger", description: "Discards the review" },
    ],
  },
];

export function DashboardPendingReviews({ reviews }: { reviews: FeedbackRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(reviews);
  const [confirm, setConfirm] = useState<{ review: FeedbackRow; decision: Decision } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);

  async function handleConfirm() {
    if (!confirm) return;
    const { review, decision } = confirm;
    setIsDeciding(true);
    try {
      await approveFeedback(getBrowserSupabaseClient(), { feedbackId: review.id, decision });
      setPending((prev) => prev.filter((r) => r.id !== review.id));
      setConfirm(null);
      // An approval changes the "Recent reviews" card and driver ratings — refetch the page.
      router.refresh();
    } catch (err) {
      setConfirm(null);
      setError(err instanceof Error ? err.message : "Could not record the decision.");
    } finally {
      setIsDeciding(false);
    }
  }

  function handleAction(review: FeedbackRow, id: string) {
    if (id === "view") router.push(`/drivers/${review.driverId}`);
    else if (id === "approved" || id === "rejected") setConfirm({ review, decision: id });
  }

  const isApprove = confirm?.decision === "approved";

  return (
    <Card className="lg:col-span-3">
      <Card.Header className="flex items-center gap-2">
        <Card.Title>Unverified reviews</Card.Title>
        {pending.length > 0 ? (
          <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">{pending.length}</span>
        ) : null}
      </Card.Header>
      <Card.Content>
        {pending.length === 0 ? (
          <EmptyState message="No reviews are waiting for approval." />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pending.slice(0, SHOWN).map((review) => (
              <div
                key={review.id}
                className="relative flex flex-col gap-1.5 rounded-xl border border-warning/40 bg-warning/5 p-3 transition-shadow hover:shadow-md"
              >
                <Link href={`/drivers/${review.driverId}`} aria-label={review.driverName} className="absolute inset-0 rounded-xl" />
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{review.driverName}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <StarRating value={review.rating} isReadOnly size={14} />
                    <ActionsMenu
                      ariaLabel={`Actions for the review of ${review.driverName}`}
                      sections={SECTIONS}
                      onAction={(id) => handleAction(review, id)}
                      isDisabled={isDeciding}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted">
                  {review.reviewerName} · {formatDate(review.createdAt)}
                </p>
                {review.description ? <p className="line-clamp-2 text-sm text-muted">{review.description}</p> : null}
              </div>
            ))}
          </div>
        )}
      </Card.Content>
      {pending.length > 0 ? (
        <Card.Footer className="flex items-center justify-between">
          <span className="text-xs text-muted">
            {pending.length > SHOWN ? `Showing ${SHOWN} of ${pending.length}.` : "Use ⋮ to approve or reject."}
          </span>
          <Link href="/drivers" className="text-sm font-medium text-accent hover:underline">
            View drivers
          </Link>
        </Card.Footer>
      ) : null}

      <ActionDialog
        isOpen={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        tone={isApprove ? "success" : "danger"}
        heading={confirm ? `${isApprove ? "Approve" : "Reject"} this review of ${confirm.review.driverName}?` : ""}
        body={
          confirm
            ? isApprove
              ? `The ${confirm.review.rating}-star rating from ${confirm.review.reviewerName} will count toward ${confirm.review.driverName}'s average.`
              : `The review from ${confirm.review.reviewerName} will be discarded and won't count toward ${confirm.review.driverName}'s rating. This can't be undone.`
            : null
        }
        confirmLabel={isApprove ? "Approve" : "Reject"}
        isPending={isDeciding}
        onConfirm={handleConfirm}
      />
      <ActionDialog
        isOpen={error !== null}
        onOpenChange={(open) => !open && setError(null)}
        heading="Couldn't record the decision"
        body={error}
      />
    </Card>
  );
}
