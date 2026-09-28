import { Chip } from "@heroui/react";

// Ported from driver-app-new's DriversTable.tsx RatingBadge: green ≥ 4, amber ≥ 3, red
// below, a muted dash when the driver has no approved reviews yet.
export function RatingBadge({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className="text-sm text-muted">—</span>;
  }
  const color: "success" | "warning" | "danger" = rating >= 4 ? "success" : rating >= 3 ? "warning" : "danger";
  return (
    <Chip color={color} variant="soft" size="sm">
      <Chip.Label>★ {rating.toFixed(1)}</Chip.Label>
    </Chip>
  );
}
