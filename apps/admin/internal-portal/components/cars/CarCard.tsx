import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import type { Car } from "@/lib/queries/cars";
import { CarStatusChip } from "./CarStatusChip";

const FUEL_LABEL: Record<string, string> = { petrol: "Petrol", diesel: "Diesel", ev: "EV" };

export function CarCard({ car }: { car: Car }) {
  return (
    <Link href={`/cars/${car.id}`}>
      <Card className="h-full">
        <Card.Header>
          <Card.Title>{car.name}</Card.Title>
          <Card.Description>{car.model}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-wrap items-center gap-2">
          <Chip size="sm">
            <Chip.Label>{FUEL_LABEL[car.fuel_type] ?? car.fuel_type}</Chip.Label>
          </Chip>
          <span className="text-sm text-muted">{car.registration_number}</span>
        </Card.Content>
        <Card.Footer>
          <CarStatusChip status={car.status} />
        </Card.Footer>
      </Card>
    </Link>
  );
}
