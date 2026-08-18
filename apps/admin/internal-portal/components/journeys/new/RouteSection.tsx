"use client";

import { Checkbox, CheckboxGroup } from "@heroui/react";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import type { GuestEntry, StopEntry } from "./formState";

function guestLabel(guests: GuestEntry[], clientId: string) {
  const guest = guests.find((g) => g.clientId === clientId);
  return guest?.fullName || "Unnamed guest";
}

function GuestCheckboxList({
  label,
  guests,
  eligibleClientIds,
  selected,
  onChange,
}: {
  label: string;
  guests: GuestEntry[];
  eligibleClientIds: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (eligibleClientIds.length === 0) {
    return <p className="text-sm text-muted">{label}: no eligible guests at this point.</p>;
  }
  return (
    <CheckboxGroup value={selected} onChange={onChange}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {eligibleClientIds.map((clientId) => (
        <Checkbox key={clientId} value={clientId}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            {guestLabel(guests, clientId)}
          </Checkbox.Content>
        </Checkbox>
      ))}
    </CheckboxGroup>
  );
}

function ArrivalTimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
      Arrival date &amp; time
      <input
        type="datetime-local"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border-2 border-border bg-transparent px-3 text-sm outline-none transition-colors focus:border-accent"
      />
    </label>
  );
}

export function FromLocationCard({
  locationName,
  onLocationChange,
  arrivalAt,
  onArrivalAtChange,
  guests,
  eligiblePickupIds,
  selectedPickupIds,
  onPickupsChange,
}: {
  locationName: string;
  onLocationChange: (value: string) => void;
  arrivalAt: string;
  onArrivalAtChange: (value: string) => void;
  guests: GuestEntry[];
  eligiblePickupIds: string[];
  selectedPickupIds: string[];
  onPickupsChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Origin — pickups only</p>
      <TextField label="Location" value={locationName} onChange={onLocationChange} isRequired fullWidth />
      <ArrivalTimeInput value={arrivalAt} onChange={onArrivalAtChange} />
      <GuestCheckboxList
        label="Pick up here"
        guests={guests}
        eligibleClientIds={eligiblePickupIds}
        selected={selectedPickupIds}
        onChange={onPickupsChange}
      />
    </div>
  );
}

export function StopCard({
  stop,
  guests,
  eligiblePickupIds,
  eligibleDropIds,
  canMoveUp,
  canMoveDown,
  onFieldChange,
  onPickupsChange,
  onDropsChange,
  onMove,
  onRemove,
}: {
  stop: StopEntry;
  guests: GuestEntry[];
  eligiblePickupIds: string[];
  eligibleDropIds: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onFieldChange: (field: "locationName" | "arrivalAt", value: string) => void;
  onPickupsChange: (next: string[]) => void;
  onDropsChange: (next: string[]) => void;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Stop</p>
        <div className="flex gap-1">
          <Button size="sm" variant="tertiary" isDisabled={!canMoveUp} onPress={() => onMove("up")}>
            ↑
          </Button>
          <Button size="sm" variant="tertiary" isDisabled={!canMoveDown} onPress={() => onMove("down")}>
            ↓
          </Button>
          <Button size="sm" variant="tertiary" onPress={onRemove}>
            Remove
          </Button>
        </div>
      </div>
      <TextField label="Location" value={stop.locationName} onChange={(v) => onFieldChange("locationName", v)} isRequired fullWidth />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Arrival date &amp; time
        <input
          type="datetime-local"
          required
          value={stop.arrivalAt}
          onChange={(e) => onFieldChange("arrivalAt", e.target.value)}
          className="h-11 rounded-lg border-2 border-border bg-transparent px-3 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GuestCheckboxList
          label="Pick up here"
          guests={guests}
          eligibleClientIds={eligiblePickupIds}
          selected={stop.pickupGuestClientIds}
          onChange={onPickupsChange}
        />
        <GuestCheckboxList
          label="Drop off here"
          guests={guests}
          eligibleClientIds={eligibleDropIds}
          selected={stop.dropoffGuestClientIds}
          onChange={onDropsChange}
        />
      </div>
    </div>
  );
}

export function ToLocationCard({
  locationName,
  onLocationChange,
  arrivalAt,
  onArrivalAtChange,
  guests,
  eligibleDropIds,
  selectedDropIds,
  onDropsChange,
}: {
  locationName: string;
  onLocationChange: (value: string) => void;
  arrivalAt: string;
  onArrivalAtChange: (value: string) => void;
  guests: GuestEntry[];
  eligibleDropIds: string[];
  selectedDropIds: string[];
  onDropsChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Destination — drops only</p>
      <TextField label="Location" value={locationName} onChange={onLocationChange} isRequired fullWidth />
      <ArrivalTimeInput value={arrivalAt} onChange={onArrivalAtChange} />
      <GuestCheckboxList
        label="Drop off here"
        guests={guests}
        eligibleClientIds={eligibleDropIds}
        selected={selectedDropIds}
        onChange={onDropsChange}
      />
    </div>
  );
}
