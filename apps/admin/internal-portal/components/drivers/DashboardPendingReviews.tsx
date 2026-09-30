"use client";

import { useMemo, useState } from "react";
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
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { PaginationBar } from "@/components/shared/PaginationBar";
import { AvailableIcon, DeactivateIcon, ViewIcon } from "@/components/shared/icons";

// Dashboard "Unverified reviews": the pending queue across all drivers as the app's
// standard primary-variant table (same DataTable as Cars/Drivers), one row per review with
// the ⋮ quick-action menu + Hero UI confirm dialog to approve or reject in place. A row
// click opens the driver. Paginated client-side (the full list is already loaded and is
// small — most reviews are auto-approved), so a long queue never stretches the dashboard;
// deciding a review drops it from state and the next one slides into the page. Ordered
// alphabetically by driver name; column headers aren't sortable on purpose, since sorting
// within one page of a paginated list would mislead.

const PAGE_SIZE = 8;

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

function byDriverName(a: FeedbackRow, b: FeedbackRow) {
  return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" }) || b.createdAt.localeCompare(a.createdAt);
}

export function DashboardPendingReviews({ reviews }: { reviews: FeedbackRow[] }) {
  const router = useRouter();
  // A–Z by driver name (then newest first within a driver), sorted once up front so the
  // pages are slices of one stable order; removing a decided review keeps that order.
  const [pending, setPending] = useState(() => [...reviews].sort(byDriverName));
  const [page, setPage] = useState(1);
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

  const columns = useMemo<DataTableColumn<FeedbackRow>[]>(
    () => [
      {
        id: "driver",
        label: "Driver",
        isRowHeader: true,
        render: (review) => <span className="font-medium text-foreground">{review.driverName}</span>,
      },
      {
        id: "reviewer",
        label: "Reviewer",
        render: (review) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{review.reviewerName}</p>
            <p className="text-xs text-muted">
              {review.reviewerKind === "employee" ? "Employee" : review.reviewerKind === "guest" ? "Guest" : "Unknown"}
              {review.reviewerPhone ? ` · ${review.reviewerPhone}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "rating",
        label: "Rating",
        render: (review) => <StarRating value={review.rating} isReadOnly size={14} />,
      },
      {
        id: "comment",
        label: "Comment",
        render: (review) =>
          review.description ? (
            <p className="max-w-xs truncate text-sm text-muted" title={review.description}>
              {review.description}
            </p>
          ) : (
            <span className="text-sm text-muted">—</span>
          ),
      },
      {
        id: "date",
        label: "Date",
        render: (review) => <span className="text-sm text-muted tabular-nums">{formatDate(review.createdAt)}</span>,
      },
      {
        id: "actions",
        label: "Actions",
        className: "w-14 text-right",
        render: (review) => (
          <div className="flex justify-end">
            <ActionsMenu
              ariaLabel={`Actions for the review of ${review.driverName}`}
              sections={SECTIONS}
              isDisabled={isDeciding}
              onAction={(id) => {
                if (id === "view") router.push(`/drivers/${review.driverId}`);
                else if (id === "approved" || id === "rejected") setConfirm({ review, decision: id });
              }}
            />
          </div>
        ),
      },
    ],
    [isDeciding, router],
  );

  // Deleting the last row of a later page would otherwise leave `page` pointing past the end.
  const pageCount = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = pending.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isApprove = confirm?.decision === "approved";

  return (
    <Card className="lg:col-span-2">
      <Card.Header className="flex-row items-center gap-2">
        <Card.Title>Unverified reviews</Card.Title>
        {pending.length > 0 ? (
          <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">{pending.length}</span>
        ) : null}
      </Card.Header>
      <Card.Content>
        <DataTable
          ariaLabel="Unverified reviews"
          columns={columns}
          rows={pageRows}
          getRowId={(review) => review.id}
          rowHref={(review) => `/drivers/${review.driverId}`}
          emptyMessage="No reviews are waiting for approval."
        />
        <PaginationBar page={currentPage} pageCount={pageCount} onPageChange={setPage} />
      </Card.Content>
      {pending.length > 0 ? (
        <Card.Footer className="flex items-center justify-between">
          <span className="text-xs text-muted">Click a row to open the driver, or use ⋮ to approve or reject.</span>
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
