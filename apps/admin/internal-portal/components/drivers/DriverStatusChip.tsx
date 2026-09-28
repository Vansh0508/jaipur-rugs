import { Chip } from "@heroui/react";
import type { DriverDisplayStatus } from "@/lib/queries/drivers";

// Mirrors CarStatusChip. Labels follow driver-app-new's (`active` reads "Available" —
// the operational meaning on a roster, and the counterpart of "On trip").
const STATUS_COLOR: Record<DriverDisplayStatus, "success" | "warning" | "danger" | "default"> = {
  active: "success",
  on_trip: "warning",
  on_leave: "default",
  suspended: "danger",
  inactive: "default",
};

const STATUS_LABEL: Record<DriverDisplayStatus, string> = {
  active: "Available",
  on_trip: "On trip",
  on_leave: "On leave",
  suspended: "Suspended",
  inactive: "Inactive",
};

export function DriverStatusChip({ status }: { status: DriverDisplayStatus }) {
  return (
    <Chip color={STATUS_COLOR[status]} size="sm">
      <Chip.Label>{STATUS_LABEL[status]}</Chip.Label>
    </Chip>
  );
}
