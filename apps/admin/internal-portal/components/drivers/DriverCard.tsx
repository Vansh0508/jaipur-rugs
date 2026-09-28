import Link from "next/link";
import type { DriverDisplayStatus, DriverListItem } from "@/lib/queries/drivers";
import { DriverActionsMenu } from "./DriverActionsMenu";
import { DriverAvatar } from "./DriverAvatar";
import { DriverStatusChip } from "./DriverStatusChip";
import { RatingBadge } from "./RatingBadge";

// driver-app-new has no driver card (its drivers page is table-only), so this is its
// CarCard layout (components/cars/CarCard.tsx here) applied to a driver: photo in place of
// the icon tile, mono driver-code pill + phone, status chip top-right, status-tinted card,
// and the rating/review summary from its DriversTable. Same stretched-link structure and
// bottom-right ⋮ menu (DriverActionsMenu) as the car card.
const CARD_TONE: Record<DriverDisplayStatus, string> = {
  active: "border-border bg-surface",
  on_trip: "border-warning/40 bg-warning/5",
  on_leave: "border-border bg-surface-secondary/60",
  suspended: "border-danger/40 bg-danger/5",
  inactive: "border-border bg-surface-secondary/60 opacity-70",
};

export function DriverCard({ driver }: { driver: DriverListItem }) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-4 transition-shadow hover:shadow-md ${CARD_TONE[driver.displayStatus]}`}
    >
      <Link href={`/drivers/${driver.id}`} aria-label={driver.full_name} className="absolute inset-0 rounded-xl" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <DriverAvatar fullName={driver.full_name} photoPath={driver.photo_path} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground" title={driver.full_name}>
              {driver.full_name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted tabular-nums">
                {driver.driver_code}
              </span>
              <span className="text-xs text-muted">{driver.phone}</span>
            </div>
          </div>
        </div>
        <div className="mt-0.5 shrink-0">
          <DriverStatusChip status={driver.displayStatus} />
        </div>
      </div>

      <div className="mt-3 flex min-h-8 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RatingBadge rating={driver.avgRating} />
          <span className="text-xs text-muted">
            {driver.reviewCount} {driver.reviewCount === 1 ? "review" : "reviews"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {driver.displayStatus === "on_trip" && driver.activeJourneyId ? (
            <Link
              href={`/journeys/${driver.activeJourneyId}`}
              className="relative z-10 text-xs font-medium text-warning underline-offset-2 hover:underline"
            >
              View active journey →
            </Link>
          ) : null}
          <DriverActionsMenu driver={driver} />
        </div>
      </div>
    </div>
  );
}
