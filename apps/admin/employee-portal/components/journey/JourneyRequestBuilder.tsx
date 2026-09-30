"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Label, TextArea, TextField as HeroTextField } from "@heroui/react";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { requestJourney } from "@jaipur-rugs/db-management-client";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { formatDate, formatTime } from "@/lib/format";
import { ActionDialog } from "@/components/shared/ActionDialog";
import { EmployeeCodeField, lookupProblem, useEmployeeLookup, useRememberedEmployeeCode } from "@/components/shared/EmployeeCodeField";
import { RequestSentDialog } from "@/components/shared/RequestSentDialog";
import { DateTimeField, FieldError, LABEL_CLS, MultiGuestSelect, PassengerKindTag, SectionHeading, TimeInput } from "./fields";
import { GuestPoolEditor } from "./GuestPool";
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

/** "Guests (3 configured)" / "Guests (2 guests, 1 employee)" for the pool button. */
function poolSummary(pool: PoolGuest[]) {
  const employees = pool.filter((g) => g.kind === "employee").length;
  if (employees === 0) return `Guests (${pool.length} configured)`;
  const guests = pool.length - employees;
  return `Guests (${guests} guest${guests === 1 ? "" : "s"}, ${employees} employee${employees === 1 ? "" : "s"})`;
}

function nowLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The admin's New journey builder (apps/admin/internal-portal components/journeys/builder/
 * JourneyBuilder.tsx), as a request: Section A — your employee ID, Date & Time, the guest pool
 * and a note for the admin team; Section B — the same vertical route timeline (Start with
 * pickups, drag-to-reorder stops with pickups and drops, Destination with everyone still on
 * board dropped automatically). No car or driver: the admin assigns them when approving.
 * "Send request" files it via journey-request-create; nothing is planned until approval.
 */
export function JourneyRequestBuilder() {
  const [employeeCode, setEmployeeCode, rememberCode] = useRememberedEmployeeCode();
  const lookup = useEmployeeLookup(employeeCode);
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
  const [notes, setNotes] = useState("");

  const [poolOpen, setPoolOpen] = useState(false);
  const [poolBackup, setPoolBackup] = useState<PoolGuest[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const mounted = useRef(false);

  const destinationIds = destinationGuestIds(pool, startIds, stops);
  const schedule = useMemo(() => buildSchedule(rideDate, startTime, stops.map((s) => s.time), endTime), [rideDate, startTime, stops, endTime]);

  useEffect(() => setRideDate((current) => current || nowLocal()), []);

  // Dirty after any change following the initial fill-in (first render + the rideDate default).
  useEffect(() => {
    if (!mounted.current) {
      if (!rideDate) return;
      mounted.current = true;
      return;
    }
    setDirty(true);
  }, [rideDate, startPoint, startTime, endPoint, endTime, pool, startIds, stops, notes]);

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

  function resetForm() {
    mounted.current = false;
    setRideDate(nowLocal());
    setStartPoint("");
    setStartTime("");
    setEndPoint("");
    setEndTime("");
    setPool([]);
    setStartIds([]);
    setStops([]);
    setNotes("");
    setErrors({});
    setSaveError("");
    setDirty(false);
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
    const cleaned = withoutMissingGuests(new Set(pool.map((g) => g.clientId)), startIds, stops);
    setStartIds(cleaned.startIds);
    setStops(cleaned.stops);
    setPoolOpen(false);
  }

  function updateStop(clientId: string, patch: Partial<BuilderStop>) {
    setStops((prev) => prev.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s)));
  }

  async function handleSend() {
    const values = { rideDate, startPoint, startTime, endPoint, endTime, pool, startIds, stops };
    const errs = validate(values);
    const who = lookupProblem(lookup, employeeCode);
    if (who) errs.employee = who;
    if (schedule[0] && schedule[0].getTime() <= Date.now()) errs.rideDate = "Pick a time from now on";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setSaveError("Fix the highlighted fields to send the request.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const { id } = await requestJourney(getSupabaseClient(), {
        employeeCode: employeeCode.trim(),
        ...buildPayload(values, schedule as Date[]),
        notes: notes.trim() || undefined,
      });
      rememberCode();
      resetForm();
      setSentId(id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to send. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const startGuests = startEligible(pool, startIds, stops);

  return (
    <div className="space-y-8">
      {/* ── Section A: Request ── */}
      <section>
        <SectionHeading label="Request" letter="A" />
        <div className="relative mb-6 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <EmployeeCodeField code={employeeCode} onChange={setEmployeeCode} lookup={lookup} showDetails={false} />
            <FieldError msg={errors.employee} />
          </div>
          <div>
            <DateTimeField label="Date & time" value={rideDate} onChange={setRideDate} />
            <FieldError msg={errors.rideDate} />
          </div>
          <div>
            <span className={LABEL_CLS}>Guests</span>
            <Button variant="outline" fullWidth className="h-10 justify-between rounded-xl" onPress={openPool}>
              <span>{pool.length > 0 ? poolSummary(pool) : "Add guests"}</span>
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
        <HeroTextField fullWidth value={notes} onChange={setNotes}>
          <Label>Note for the admin team</Label>
          <TextArea rows={2} placeholder="What the trip is for, luggage, anything the driver should know (optional)" />
        </HeroTextField>
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
                    <p className="mt-1 text-xs italic text-muted">No guests are scheduled to be dropped at the destination. Make sure they are picked up first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {pool
                        .filter((g) => destinationIds.includes(g.clientId))
                        .map((g) => (
                          <div key={g.clientId} className="flex flex-col rounded-lg border border-border bg-surface-secondary/60 px-3 py-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              {g.name}
                              {g.kind === "employee" ? <PassengerKindTag /> : null}
                            </span>
                            <span className="text-[10px] text-muted tabular-nums">{g.kind === "employee" ? g.employeeCode : g.phone}</span>
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

      {/* Sticky send bar */}
      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-surface/90 py-4 backdrop-blur">
        {saveError ? <p className="text-sm text-danger">{saveError}</p> : <p className="text-xs text-muted">The admin team assigns the car and driver when they approve.</p>}
        <div className="ml-auto flex items-center gap-3">
          <Button variant="ghost" isDisabled={saving || !dirty} onPress={() => setClearOpen(true)}>
            Clear
          </Button>
          <Button isPending={saving} onPress={handleSend}>
            Send request
          </Button>
        </div>
      </div>

      <ActionDialog
        isOpen={clearOpen}
        onOpenChange={setClearOpen}
        heading="Clear this request?"
        body="Everything you've entered will be removed."
        cancelLabel="Keep editing"
        confirmLabel="Clear"
        onConfirm={() => {
          resetForm();
          setClearOpen(false);
        }}
      />
      <RequestSentDialog
        isOpen={sentId !== null}
        onClose={() => setSentId(null)}
        heading="Journey request sent"
        body="The admin team will review it and assign a car and driver. Nothing is planned until they approve."
        reference={sentId}
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
