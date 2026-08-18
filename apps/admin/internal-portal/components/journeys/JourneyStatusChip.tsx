import { Chip } from "@heroui/react";
import type { Enums } from "@jaipur-rugs/supabase-client";

type JourneyStatus = Enums<"journey_status">;

const STATUS_COLOR: Record<JourneyStatus, "accent" | "success" | "default" | "danger"> = {
  planned: "accent",
  ongoing: "success",
  completed: "default",
  cancelled: "danger",
};

const STATUS_LABEL: Record<JourneyStatus, string> = {
  planned: "Planned",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function JourneyStatusChip({ status }: { status: JourneyStatus }) {
  return (
    <Chip color={STATUS_COLOR[status]} size="sm">
      <Chip.Label>{STATUS_LABEL[status]}</Chip.Label>
    </Chip>
  );
}
