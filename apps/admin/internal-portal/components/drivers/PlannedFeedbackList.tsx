import { StarRating } from "@jaipur-rugs/ui-kit";
import type { FeedbackRow } from "@/lib/queries/feedback";
import { EmptyState } from "@/components/shared/EmptyState";

// Feedback tied to a planned ride — already corroborated by a journey record, so it's
// shown read-only with no approval action (unlike UnplannedFeedbackApprovalList).
export function PlannedFeedbackList({ feedback }: { feedback: FeedbackRow[] }) {
  if (feedback.length === 0) return <EmptyState message="No feedback from planned rides yet." />;
  return (
    <div className="flex flex-col gap-3">
      {feedback.map((f) => (
        <div key={f.id} className="rounded-lg border-2 border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">{f.travelDate}</span>
            <StarRating value={f.rating} isReadOnly size={16} />
          </div>
          {f.description ? <p className="mt-1 text-sm">{f.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
