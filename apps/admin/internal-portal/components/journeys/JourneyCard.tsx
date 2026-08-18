import Link from "next/link";
import { Card } from "@heroui/react";
import type { JourneySummary } from "@/lib/queries/journeys";
import { JourneyStatusChip } from "./JourneyStatusChip";

// Reused across Dashboard, Journeys list, Car detail, and Driver detail — one prop shape
// context-agnostic enough that all four call sites just pass a JourneySummary.
export function JourneyCard({ journey, variant = "detailed" }: { journey: JourneySummary; variant?: "compact" | "detailed" }) {
  return (
    <Card variant="transparent" className="w-full">
      <Card.Header>
        <Card.Title className="text-base">
          {journey.dateFrom === journey.dateTo ? journey.dateFrom : `${journey.dateFrom} – ${journey.dateTo}`}
        </Card.Title>
        <Card.Description>{journey.routeSummary || "Route not set"}</Card.Description>
      </Card.Header>
      {variant === "detailed" ? (
        <Card.Content className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>{journey.guestCount} guest{journey.guestCount === 1 ? "" : "s"}</span>
          {journey.carLabel ? <span>{journey.carLabel}</span> : null}
          {journey.driverLabel ? <span>{journey.driverLabel}</span> : null}
        </Card.Content>
      ) : null}
      <Card.Footer className="flex items-center justify-between">
        <JourneyStatusChip status={journey.status} />
        <Link href={`/journeys/${journey.id}`} className="text-sm font-medium text-accent hover:underline">
          View
        </Link>
      </Card.Footer>
    </Card>
  );
}
