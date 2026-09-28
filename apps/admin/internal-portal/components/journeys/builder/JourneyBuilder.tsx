"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { createJourney } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { getAvailableCarsForWindow, type CarAvailability } from "@/lib/queries/cars";
import { getAvailableDriversForWindow, type DriverAvailability } from "@/lib/queries/drivers";
import { formatDate, formatTime } from "@/lib/format";
import { ActionDialog } from "@/components/shared/ActionDialog";
import { DateTimeField, FieldError, LABEL_CLS, MultiGuestSelect, SectionHeading, TimeInput } from "./fields";
import { GuestPoolEditor } from "./GuestPool";
import { CarPicker, DriverPicker } from "./pickers";
import {
  buildPayload,
  buildSchedule,
  destinationGuestIds,
  emptyGuest,
  emptyStop,
  isGuestInRoute,
  startEligible,
  stopEligible,
  validate,
  validatePool,
  withoutMissingGuests,
  type BuilderStop,
  type PoolGuest,
} from "./model";

function nowLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * driver-app-new's JourneyBuilder (its "New Journey" page), on this app's schema and
 * write path: Section A — car, driver, Date & Time, and the guest pool; Section B — a
 * vertical route timeline: Start (pickups only), drag-to-reorder intermediate stops
 * (pickups + drops), Destination (drops auto-assigned: everyone still on board), then a
 * sticky save bar with an unsaved-changes guard. Saved via create-journey (atomic
 * create_journey RPC), which also matches-or-creates guests by phone.
 *
 * Differences forced by the schema, not style: every stop needs a location and a time
 * (journey_stops.location_name / arrival_at are NOT NULL — driver-app-new allowed blanks),
 * and the car/driver lists are checked against this journey's actual time window.
 */
export function JourneyBuilder() {
  const router = useRouter();

  const [carId, setCarId] = useState("");
  const [driverId, setDriverId] = useState("");
  // Filled in on mount, not during render: a server-rendered "now" can land on a different
  // minute than the browser's, which is a hydration mismatch.
  const [rideDate, setRideDate] = useState("");
  const [startPoint, setStartPoint] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endPoint, setEndPoint] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pool, setPool] = useState<PoolGuest[]>([]);
  const [startIds, setStartIds] = useState<string[]>([]);
  const [stops, setStops] = useState<BuilderStop[]>([]);

  const [poolOpen, setPoolOpen] = useState(false);
  const [poolBackup, setPoolBackup] = useState<PoolGuest[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const mounted = useRef(false);

  const [cars, setCars] = useState<CarAvailability[]>([]);
  const [drivers, setDrivers] = useState<DriverAvailability[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  const destinationIds = destinationGuestIds(pool, startIds, stops);
  const schedule = useMemo(
    () => buildSchedule(rideDate, startTime, stops.map((s) => s.time), endTime),
    [rideDate, startTime, stops, endTime],
  );
  const windowStart = schedule[0] ?? null;
  // Until the destination time is set, check availability through the end of the start day.
  const windowEnd =
    schedule[schedule.length - 1] ??
    (windowStart ? new Date(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate(), 23, 59, 59) : null);
  const startIso = windowStart?.toISOString() ?? "";
  const endIso = windowEnd?.toISOString() ?? "";

  // Car/driver availability for this journey's window, re-checked (debounced) as it changes.
  useEffect(() => {
    if (!startIso || !endIso) return;
    setLoadingAvailability(true);
    const timer = setTimeout(async () => {
      const supabase = getBrowserSupabaseClient();
      try {
        const [c, d] = await Promise.all([
          getAvailableCarsForWindow(supabase, startIso, endIso),
          getAvailableDriversForWindow(supabase, startIso, endIso),
        ]);
        setCars(c);
        setDrivers(d);
      } finally {
        setLoadingAvailability(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [startIso, endIso]);

  useEffect(() => setRideDate((current) => current || nowLocal()), []);

  // Dirty after any change following the initial fill-in (first render + the rideDate default).
  useEffect(() => {
    if (!mounted.current) {
      if (!rideDate) return;
      mounted.current = true;
      return;
    }
    setDirty(true);
  }, [carId, driverId, rideDate, startPoint, startTime, endPoint, endTime, pool, startIds, stops]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function clearErrors(predicate: (key: string) => boolean) {
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !predicate(k))));
  }

  function openPool() {
    setPoolBackup(structuredClone(pool));
    if (pool.length === 0) setPool([emptyGuest()]);
    setPoolOpen(true);
  }
  function cancelPool() {
    setPool(poolBackup);
    clearErrors((k) => k.startsWith("guest_"));
    setPoolOpen(false);
  }
  function savePool() {
    const poolErrors = validatePool(pool);
    clearErrors((k) => k.startsWith("guest_") || k === "guests");
    if (Object.keys(poolErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...poolErrors }));
      return;
    }
    // Belt-and-braces: guests on the route can't be removed, but never leave dangling ids.
    const cleaned = withoutMissingGuests(new Set(pool.map((g) => g.clientId)), startIds, stops);
    setStartIds(cleaned.startIds);
    setStops(cleaned.stops);
    setPoolOpen(false);
  }

  function updateStop(clientId: string, patch: Partial<BuilderStop>) {
    setStops((prev) => prev.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s)));
  }

  const selectedCar = cars.find((c) => c.id === carId);
  const selectedDriver = drivers.find((d) => d.id === driverId);

  async function handleSave() {
    const values = { carId, driverId, rideDate, startPoint, startTime, endPoint, endTime, pool, startIds, stops };
    const errs = validate(values);
    if (selectedCar && !selectedCar.isAvailable) errs.car = `This car isn't available then (${selectedCar.unavailableReason})`;
    if (selectedDriver && !selectedDriver.isAvailable) errs.driver = `This driver isn't available then (${selectedDriver.unavailableReason})`;
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setSaveError("Fix the highlighted fields to save.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const { id } = await createJourney(getBrowserSupabaseClient(), {
        vehicleId: carId,
        driverId,
        ...buildPayload(values, schedule as Date[]),
      });
      setDirty(false);
      router.push(`/journeys/${id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save. Please try again.");
      setSaving(false);
    }
  }

  const startGuests = startEligible(pool, startIds, stops);

  return (
    <div className="space-y-8">
      {/* ── Section A: Assignment ── */}
      <section>
        <SectionHeading label="Assignment" letter="A" />
        <div className="relative mb-6 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <CarPicker cars={cars} value={carId} onChange={setCarId} isLoading={loadingAvailability} />
            <FieldError msg={errors.car} />
          </div>
          <div>
            <DriverPicker drivers={drivers} value={driverId} onChange={setDriverId} isLoading={loadingAvailability} />
            <FieldError msg={errors.driver} />
          </div>
          <div>
            <DateTimeField label="Date & time" value={rideDate} onChange={setRideDate} />
            <FieldError msg={errors.rideDate} />
          </div>
          <div>
            <span className={LABEL_CLS}>Guests</span>
            <Button variant="outline" fullWidth className="h-10 justify-between rounded-xl" onPress={openPool}>
              <span>{pool.length > 0 ? `Guests (${pool.length} configured)` : "Add guests"}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </Button>
            <FieldError msg={errors.guests} />
          </div>

          {poolOpen ? (
            <GuestPoolEditor
              pool={pool}
              errors={errors}
              isInRoute={(id) => isGuestInRoute(id, startIds, stops)}
              onChange={(g) => setPool((prev) => prev.map((x) => (x.clientId === g.clientId ? g : x)))}
              onAdd={() => setPool((prev) => [...prev, emptyGuest()])}
              onRemove={(id) => setPool((prev) => prev.filter((x) => x.clientId !== id))}
              onCancel={cancelPool}
              onSave={savePool}
            />
          ) : null}
        </div>
      </section>

      {/* ── Section B: Route plan ── */}
      <section>
        <SectionHeading label="Route plan" letter="B" />
        {errors.route ? <p className="mb-4 text-sm text-danger">{errors.route}</p> : null}

        <div className="relative space-y-6 pl-10">
          <div className="pointer-events-none absolute bottom-4 left-4 top-4 w-0.5 border-l-2 border-dashed border-border" />

          {/* Start */}
          <div className="relative">
            <div className="absolute -left-10 top-1 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-foreground text-background shadow-sm">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor">
                <circle cx="7" cy="7" r="4" />
              </svg>
            </div>
            <div className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Start location</span>
                <span className="rounded bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase text-success">Pickup only</span>
              </div>
              <div className="grid items-start gap-4 sm:grid-cols-3">
                <div>
                  <TimeInput label="Time" value={startTime || rideDate.slice(11, 16)} onChange={setStartTime} />
                  {schedule[0] ? <p className="mt-1 text-[11px] text-muted">{formatDate(schedule[0].toISOString())}</p> : null}
                </div>
                <div>
                  <TextField label="Location name" value={startPoint} onChange={setStartPoint} isRequired fullWidth />
                  <FieldError msg={errors.start} />
                </div>
                <div>
                  <span className={LABEL_CLS}>Select guests to pick up</span>
                  <MultiGuestSelect guests={startGuests} selectedIds={startIds} onChange={setStartIds} placeholder="Select guests to pick up…" />
                </div>
              </div>
            </div>
          </div>

          {/* Intermediate stops — drag the numbered handle to reorder */}
          {stops.length > 0 ? (
            <Reorder.Group axis="y" values={stops} onReorder={setStops} className="space-y-6">
              {stops.map((stop, index) => {
                const eligible = stopEligible(pool, startIds, stops, index);
                const at = schedule[index + 1];
                return (
                  <StopItem key={stop.clientId} stop={stop} index={index}>
                    <div className="grid items-start gap-4 border-t border-border pt-3 sm:grid-cols-4">
                      <div>
                        <TimeInput label="Time" value={stop.time} onChange={(time) => updateStop(stop.clientId, { time })} />
                        {at ? <p className="mt-1 text-[11px] text-muted">{formatDate(at.toISOString())}</p> : null}
                        <FieldError msg={errors[`stop_${stop.clientId}_time`]} />
                      </div>
                      <div>
                        <TextField label="Location name" value={stop.location} onChange={(location) => updateStop(stop.clientId, { location })} isRequired fullWidth />
                        <FieldError msg={errors[`stop_${stop.clientId}_location`]} />
                      </div>
                      <div>
                        <span className={LABEL_CLS}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-success" /> Guests to pick up
                          </span>
                        </span>
                        <MultiGuestSelect
                          guests={eligible.forPickup}
                          selectedIds={stop.pickupIds}
                          onChange={(pickupIds) => updateStop(stop.clientId, { pickupIds })}
                          placeholder="Select guests to pick up…"
                        />
                      </div>
                      <div>
                        <span className={LABEL_CLS}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-warning" /> Guests to drop off
                          </span>
                        </span>
                        <MultiGuestSelect
                          guests={eligible.forDrop}
                          selectedIds={stop.dropIds}
                          onChange={(dropIds) => updateStop(stop.clientId, { dropIds })}
                          placeholder="Select guests to drop off…"
                        />
                      </div>
                    </div>
                    <RemoveStopButton onPress={() => setStops((prev) => prev.filter((s) => s.clientId !== stop.clientId))} />
                  </StopItem>
                );
              })}
            </Reorder.Group>
          ) : null}

          <div className="flex justify-center py-2">
            <Button variant="outline" size="sm" className="border-dashed" onPress={() => setStops((prev) => [...prev, emptyStop()])}>
              + Add stop in between
            </Button>
          </div>

          {/* Destination */}
          <div className="relative">
            <div className="absolute -left-10 top-1 z-10 flex size-8 items-center justify-center rounded-full border-2 border-muted bg-surface text-foreground shadow-sm">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M7 2l1.5 3H12L9.25 7l1 3.25L7 8.5 4.75 10.25l1-3.25L3 5h3.5L7 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Destination</span>
                <span className="rounded bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase text-warning">Drop only</span>
              </div>
              <div className="grid items-start gap-4 sm:grid-cols-3">
                <div>
                  <TimeInput label="Time" value={endTime} onChange={setEndTime} />
                  {schedule[schedule.length - 1] ? (
                    <p className="mt-1 text-[11px] text-muted">
                      {formatDate(schedule[schedule.length - 1]!.toISOString())} · {formatTime(schedule[schedule.length - 1]!.toISOString())}
                    </p>
                  ) : null}
                  <FieldError msg={errors.endTime} />
                </div>
                <div>
                  <TextField label="Location name" value={endPoint} onChange={setEndPoint} isRequired fullWidth />
                  <FieldError msg={errors.end} />
                </div>
                <div>
                  <span className={LABEL_CLS}>Guests dropped off (auto assigned)</span>
                  {destinationIds.length === 0 ? (
                    <p className="mt-1 text-xs italic text-muted">
                      No guests are scheduled to be dropped at the destination. Make sure they are picked up first.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {pool
                        .filter((g) => destinationIds.includes(g.clientId))
                        .map((g) => (
                          <div key={g.clientId} className="flex flex-col rounded-lg border border-border bg-surface-secondary/60 px-3 py-1.5">
                            <span className="text-xs font-semibold text-foreground">{g.name}</span>
                            <span className="text-[10px] text-muted tabular-nums">{g.phone}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-surface/90 py-4 backdrop-blur">
        {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
        <div className="ml-auto flex items-center gap-3">
          <Button variant="ghost" isDisabled={saving} onPress={() => (dirty ? setLeaveOpen(true) : router.back())}>
            Cancel
          </Button>
          <Button isPending={saving} onPress={handleSave}>
            Save journey
          </Button>
        </div>
      </div>

      <ActionDialog
        isOpen={leaveOpen}
        onOpenChange={setLeaveOpen}
        heading="Leave without saving?"
        body="You have unsaved changes. If you leave now, all changes will be discarded."
        cancelLabel="Stay"
        confirmLabel="Leave page"
        onConfirm={() => {
          setDirty(false);
          setLeaveOpen(false);
          router.back();
        }}
      />
    </div>
  );
}

/** One draggable stop card. Only the numbered handle starts a drag, so typing in the fields never does. */
function StopItem({ stop, index, children }: { stop: BuilderStop; index: number; children: React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={stop} dragListener={false} dragControls={controls} className="relative">
      <button
        type="button"
        aria-label={`Drag to reorder stop ${index + 1}`}
        onPointerDown={(e) => controls.start(e)}
        className="absolute -left-10 top-1 z-10 flex size-8 cursor-grab touch-none items-center justify-center rounded-full border-2 border-border bg-surface text-xs font-bold text-foreground shadow-sm active:cursor-grabbing"
      >
        {index + 1}
      </button>
      <div className="relative space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Stop {index + 1}</span>
          <span className="text-border">·</span>
          <span className="text-[10px] text-muted">Drag the number to reorder</span>
        </div>
        {children}
      </div>
    </Reorder.Item>
  );
}

function RemoveStopButton({ onPress }: { onPress: () => void }) {
  return (
    <div className="absolute right-3 top-3">
      <Button size="sm" variant="ghost" isIconOnly aria-label="Remove stop" onPress={onPress} className="text-muted hover:text-danger">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 2l10 10M12 2L2 12" />
        </svg>
      </Button>
    </div>
  );
}
