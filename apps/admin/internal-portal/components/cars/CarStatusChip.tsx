import { Chip } from "@heroui/react";
import type { Enums } from "@jaipur-rugs/supabase-client";

type VehicleStatus = Enums<"vehicle_status">;

const STATUS_COLOR: Record<VehicleStatus, "success" | "warning" | "danger" | "default"> = {
  vacant: "success",
  on_trip: "warning",
  maintenance: "danger",
  accidental: "danger",
  inactive: "default",
};

const STATUS_LABEL: Record<VehicleStatus, string> = {
  vacant: "Vacant",
  on_trip: "On trip",
  maintenance: "Maintenance",
  accidental: "Accidental",
  inactive: "Inactive",
};

export function CarStatusChip({ status }: { status: VehicleStatus }) {
  return (
    <Chip color={STATUS_COLOR[status]} size="sm">
      <Chip.Label>{STATUS_LABEL[status]}</Chip.Label>
    </Chip>
  );
}
