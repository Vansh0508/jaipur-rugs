"use client";

import { ListBox, Select } from "@heroui/react";
import type { CarAvailability } from "@/lib/queries/cars";
import type { DriverAvailability } from "@/lib/queries/drivers";
import { CarTileIcon } from "@/components/shared/icons";
import { LABEL_CLS } from "./fields";

// driver-app-new's Car / Driver dropdowns (icon or initials, identity, status dot), fed by
// this app's time-window availability instead of a static status: a car/driver busy on an
// overlapping journey, in maintenance/accidental, on leave or suspended is listed but
// disabled, with the reason. The DB's EXCLUDE constraints remain the real guarantee.

function StatusDot({ available, reason }: { available: boolean; reason: string | null }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${available ? "bg-success" : "bg-warning"}`} />
      <span className="text-[11px] text-muted">{available ? "Available" : reason}</span>
    </span>
  );
}

export function CarPicker({
  cars,
  value,
  onChange,
  isLoading,
}: {
  cars: CarAvailability[];
  value: string;
  onChange: (id: string) => void;
  isLoading: boolean;
}) {
  const selected = cars.find((c) => c.id === value);
  return (
    <div>
      <span className={LABEL_CLS}>Car</span>
      <Select
        aria-label="Car"
        className="w-full"
        value={value || null}
        onChange={(key) => onChange(key == null ? "" : String(key))}
        disabledKeys={cars.filter((c) => !c.isAvailable && c.id !== value).map((c) => c.id)}
      >
        <Select.Trigger>
          <Select.Value>
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-xs font-semibold tracking-wide tabular-nums">{selected.registrationNumber}</span>
                <span className="truncate text-xs text-muted">{selected.name}</span>
              </span>
            ) : (
              <span className="text-sm text-muted">{isLoading ? "Checking availability…" : "Select a car…"}</span>
            )}
          </Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="min-w-80">
          <ListBox className="max-h-72 overflow-y-auto">
            {cars.map((c) => (
              <ListBox.Item key={c.id} id={c.id} textValue={`${c.registrationNumber} ${c.name}`} className={c.isAvailable ? "" : "opacity-50"}>
                <div className="flex w-full min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                    <CarTileIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold tracking-wide tabular-nums">{c.registrationNumber}</span>
                    <span className="block truncate text-[11px] text-muted">{c.name}</span>
                  </span>
                  <StatusDot available={c.isAvailable} reason={c.unavailableReason} />
                </div>
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}

export function DriverPicker({
  drivers,
  value,
  onChange,
  isLoading,
}: {
  drivers: DriverAvailability[];
  value: string;
  onChange: (id: string) => void;
  isLoading: boolean;
}) {
  const selected = drivers.find((d) => d.id === value);
  return (
    <div>
      <span className={LABEL_CLS}>Driver</span>
      <Select
        aria-label="Driver"
        className="w-full"
        value={value || null}
        onChange={(key) => onChange(key == null ? "" : String(key))}
        disabledKeys={drivers.filter((d) => !d.isAvailable && d.id !== value).map((d) => d.id)}
      >
        <Select.Trigger>
          <Select.Value>
            {selected ? (
              <span className="truncate text-sm font-medium">{selected.fullName}</span>
            ) : (
              <span className="text-sm text-muted">{isLoading ? "Checking availability…" : "Select a driver…"}</span>
            )}
          </Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="min-w-80">
          <ListBox className="max-h-72 overflow-y-auto">
            {drivers.map((d) => {
              const initials = d.fullName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <ListBox.Item key={d.id} id={d.id} textValue={d.fullName} className={d.isAvailable ? "" : "opacity-50"}>
                  <div className="flex w-full min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-secondary text-xs font-semibold">
                      {initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{d.fullName}</span>
                      <span className="block text-[11px] text-muted tabular-nums">{d.phone}</span>
                    </span>
                    <StatusDot available={d.isAvailable} reason={d.unavailableReason} />
                  </div>
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
