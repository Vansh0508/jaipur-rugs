"use client";

import { useState } from "react";
import { StarRating } from "@jaipur-rugs/ui-kit";
import { Button } from "@jaipur-rugs/ui-kit";
import { approveFeedback } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { FeedbackRow } from "@/lib/queries/feedback";
import { EmptyState } from "@/components/shared/EmptyState";

// Feedback for an unplanned ride has no journey record to corroborate it — pending admin
// approval before it counts (fraud-prevention). Optimistic removal from the list on a
// decision, matching the plan's "no lingering resolved rows in the pending queue" intent.
export function UnplannedFeedbackApprovalList({ feedback }: { feedback: FeedbackRow[] }) {
  const [pending, setPending] = useState(feedback);
  const [errorByRow, setErrorByRow] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function handleDecision(feedbackId: string, decision: "approved" | "rejected") {
    setDecidingId(feedbackId);
    setErrorByRow((prev) => ({ ...prev, [feedbackId]: "" }));
    try {
      await approveFeedback(getBrowserSupabaseClient(), { feedbackId, decision });
      setPending((prev) => prev.filter((f) => f.id !== feedbackId));
    } catch (err) {
      setErrorByRow((prev) => ({
        ...prev,
        [feedbackId]: err instanceof Error ? err.message : "Could not record decision.",
      }));
    } finally {
      setDecidingId(null);
    }
  }

  if (pending.length === 0) return <EmptyState message="No unplanned reviews pending approval." />;

  return (
    <div className="flex flex-col gap-3">
      {pending.map((f) => (
        <div key={f.id} className="rounded-lg border-2 border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">{f.travelDate}</span>
            <StarRating value={f.rating} isReadOnly size={16} />
          </div>
          {f.description ? <p className="mt-1 text-sm">{f.description}</p> : null}
          {errorByRow[f.id] ? <p className="mt-1 text-sm text-danger">{errorByRow[f.id]}</p> : null}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              isPending={decidingId === f.id}
              onPress={() => handleDecision(f.id, "approved")}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              isPending={decidingId === f.id}
              onPress={() => handleDecision(f.id, "rejected")}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
