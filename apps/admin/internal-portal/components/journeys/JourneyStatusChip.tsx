import { Chip } from "@heroui/react";
import type { JourneyStatus } from "@/lib/journeyStatus";

// Pass a journey's `displayStatus` (derived from its times, lib/journeyStatus.ts), not the
// stored column — stored `planned` stays `planned` forever unless cancelled/ended.
const STATUS_COLOR: Record<JourneyStatus, "accent" | "success" | "default" | "danger"> = {
  planned: "accent",
  ongoing: "success",
  completed: "default",
  cancelled: "danger",
};

const STATUS_LABEL: Record<JourneyStatus, string> = {
  planned: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function JourneyStatusChip({ status }: { status: JourneyStatus }) {
  return (
    <Chip color={STATUS_COLOR[status]} variant="soft" size="sm">
      {/* driver-app-new's live pulse on an in-progress journey */}
      {status === "ongoing" ? <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-success" /> : null}
      <Chip.Label>{STATUS_LABEL[status]}</Chip.Label>
    </Chip>
  );
}
