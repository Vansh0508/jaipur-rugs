"use client";

import { Description, Radio, RadioGroup } from "@heroui/react";
import type { CarAvailability } from "@/lib/queries/cars";
import type { DriverAvailability } from "@/lib/queries/drivers";

// A RadioGroup of card-styled options, not a Select dropdown — with ~14 cars/13 drivers,
// showing all of them at once with visible availability beats a closed dropdown an admin
// has to open just to see status. Unavailable options stay visible (not hidden) with an
// always-legible reason, since disabled elements are unreliable hover targets.

export function CarAvailabilitySection({
  cars,
  isLoading,
  value,
  onChange,
}: {
  cars: CarAvailability[];
  isLoading: boolean;
  value: string | null;
  onChange: (vehicleId: string) => void;
}) {
  if (isLoading) return <p className="text-sm text-muted">Checking car availability…</p>;
  if (cars.length === 0) return <p className="text-sm text-muted">Set the date range above to see available cars.</p>;

  return (
    // value defaults to "" (never undefined) so the RadioGroup is controlled from the
    // first render — switching between undefined and a string later triggers React's
    // "component changed from uncontrolled to controlled" warning.
    <RadioGroup value={value ?? ""} onChange={onChange} name="vehicleId">
      <span className="text-sm font-medium text-foreground">Car</span>
      {cars.map((car) => (
        <Radio key={car.id} value={car.id} isDisabled={!car.isAvailable}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {car.name} — {car.registrationNumber}
          </Radio.Content>
          {!car.isAvailable ? <Description className="text-danger">{car.unavailableReason}</Description> : null}
        </Radio>
      ))}
    </RadioGroup>
  );
}

export function DriverAvailabilitySection({
  drivers,
  isLoading,
  value,
  onChange,
}: {
  drivers: DriverAvailability[];
  isLoading: boolean;
  value: string | null;
  onChange: (driverId: string) => void;
}) {
  if (isLoading) return <p className="text-sm text-muted">Checking driver availability…</p>;
  if (drivers.length === 0) return <p className="text-sm text-muted">Set the date range above to see available drivers.</p>;

  return (
    <RadioGroup value={value ?? ""} onChange={onChange} name="driverId">
      <span className="text-sm font-medium text-foreground">Driver</span>
      {drivers.map((driver) => (
        <Radio key={driver.id} value={driver.id} isDisabled={!driver.isAvailable}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {driver.fullName}
          </Radio.Content>
          {!driver.isAvailable ? <Description className="text-danger">{driver.unavailableReason}</Description> : null}
        </Radio>
      ))}
    </RadioGroup>
  );
}
