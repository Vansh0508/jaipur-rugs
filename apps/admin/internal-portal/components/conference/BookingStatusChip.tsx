import { Chip } from "@heroui/react";
import type { ConferenceBookingPhase } from "@/lib/queries/conference";

// Pass a booking's phase (bookingPhase(), derived from its times and status), not the stored
// status — a confirmed booking is "upcoming", "ongoing" or "completed" depending on the clock.
const PHASE_COLOR: Record<ConferenceBookingPhase, "accent" | "success" | "default" | "danger"> = {
  upcoming: "accent",
  ongoing: "success",
  completed: "default",
  cancelled: "danger",
};

const PHASE_LABEL: Record<ConferenceBookingPhase, string> = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function BookingStatusChip({ phase }: { phase: ConferenceBookingPhase }) {
  return (
    <Chip color={PHASE_COLOR[phase]} variant="soft" size="sm">
      {phase === "ongoing" ? <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-success" /> : null}
      <Chip.Label>{PHASE_LABEL[phase]}</Chip.Label>
    </Chip>
  );
}
