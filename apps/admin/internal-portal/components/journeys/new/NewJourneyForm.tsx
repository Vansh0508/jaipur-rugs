"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DateRangeField } from "@jaipur-rugs/ui-kit";
import { createJourney, JourneyConflictError } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { getAvailableCarsForWindow, type CarAvailability } from "@/lib/queries/cars";
import { getAvailableDriversForWindow, type DriverAvailability } from "@/lib/queries/drivers";
import {
  guestsAvailableToDropAt,
  guestsAvailableToPickAt,
  guestsNeverDropped,
  initialFormState,
  newJourneyFormReducer,
} from "./formState";
import { GuestsSection } from "./GuestsSection";
import { FromLocationCard, StopCard, ToLocationCard } from "./RouteSection";
import { CarAvailabilitySection, DriverAvailabilitySection } from "./CarDriverSection";

export function NewJourneyForm() {
  const router = useRouter();
  const [state, dispatch] = useReducer(newJourneyFormReducer, initialFormState);
  const [cars, setCars] = useState<CarAvailability[]>([]);
  const [drivers, setDrivers] = useState<DriverAvailability[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!state.dateRange.start || !state.dateRange.end) {
      setCars([]);
      setDrivers([]);
      return;
    }
    const startIso = new Date(`${state.dateRange.start}T00:00:00`).toISOString();
    const endIso = new Date(`${state.dateRange.end}T23:59:59`).toISOString();
    const supabase = getBrowserSupabaseClient();
    setLoadingAvailability(true);
    Promise.all([getAvailableCarsForWindow(supabase, startIso, endIso), getAvailableDriversForWindow(supabase, startIso, endIso)])
      .then(([carResults, driverResults]) => {
        setCars(carResults);
        setDrivers(driverResults);
      })
      .finally(() => setLoadingAvailability(false));
  }, [state.dateRange.start, state.dateRange.end]);

  const neverDropped = guestsNeverDropped(state);

  const canSubmit =
    Boolean(state.dateRange.start && state.dateRange.end) &&
    state.guests.length > 0 &&
    Boolean(state.fromLocationName.trim()) &&
    Boolean(state.fromArrivalAt) &&
    Boolean(state.toLocationName.trim()) &&
    Boolean(state.toArrivalAt) &&
    state.stops.every((s) => s.locationName.trim() && s.arrivalAt) &&
    Boolean(state.vehicleId) &&
    Boolean(state.driverId) &&
    neverDropped.length === 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const phoneByClientId = new Map(state.guests.map((g) => [g.clientId, g.phone]));
    const stopsPayload = [
      {
        sequenceNo: 0,
        role: "origin" as const,
        locationName: state.fromLocationName,
        arrivalAt: new Date(state.fromArrivalAt).toISOString(),
        pickups: state.fromPickupGuestClientIds.map((id) => phoneByClientId.get(id)!),
        drops: [] as string[],
      },
      ...state.stops.map((stop, index) => ({
        sequenceNo: index + 1,
        role: "stop" as const,
        locationName: stop.locationName,
        arrivalAt: new Date(stop.arrivalAt).toISOString(),
        pickups: stop.pickupGuestClientIds.map((id) => phoneByClientId.get(id)!),
        drops: stop.dropoffGuestClientIds.map((id) => phoneByClientId.get(id)!),
      })),
      {
        sequenceNo: state.stops.length + 1,
        role: "destination" as const,
        locationName: state.toLocationName,
        arrivalAt: new Date(state.toArrivalAt).toISOString(),
        pickups: [] as string[],
        drops: state.toDropoffGuestClientIds.map((id) => phoneByClientId.get(id)!),
      },
    ];

    try {
      const { id } = await createJourney(getBrowserSupabaseClient(), {
        vehicleId: state.vehicleId!,
        driverId: state.driverId!,
        guests: state.guests.map((g) => ({ guestId: g.guestId ?? undefined, fullName: g.fullName, phone: g.phone })),
        stops: stopsPayload,
      });
      router.push(`/journeys/${id}`);
    } catch (err) {
      if (err instanceof JourneyConflictError) {
        setSubmitError(err.message);
      } else {
        setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <DateRangeField label="Date range" value={state.dateRange} onChange={(range) => dispatch({ type: "SET_DATE_RANGE", range })} isRequired />

      <GuestsSection
        guests={state.guests}
        onAdd={() => dispatch({ type: "ADD_GUEST" })}
        onChange={(clientId, guest) => dispatch({ type: "SET_GUEST", clientId, guest })}
        onRemove={(clientId) => dispatch({ type: "REMOVE_GUEST", clientId })}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Route</h2>
        <FromLocationCard
          locationName={state.fromLocationName}
          onLocationChange={(v) => dispatch({ type: "SET_FROM_LOCATION", locationName: v })}
          arrivalAt={state.fromArrivalAt}
          onArrivalAtChange={(v) => dispatch({ type: "SET_FROM_ARRIVAL_AT", value: v })}
          guests={state.guests}
          eligiblePickupIds={state.guests.map((g) => g.clientId)}
          selectedPickupIds={state.fromPickupGuestClientIds}
          onPickupsChange={(next) => dispatch({ type: "SET_FROM_PICKUPS", guestClientIds: next })}
        />

        {state.stops.map((stop, index) => (
          <StopCard
            key={stop.clientId}
            stop={stop}
            guests={state.guests}
            eligiblePickupIds={guestsAvailableToPickAt(state, stop.clientId)}
            eligibleDropIds={guestsAvailableToDropAt(state, stop.clientId)}
            canMoveUp={index > 0}
            canMoveDown={index < state.stops.length - 1}
            onFieldChange={(field, value) => dispatch({ type: "SET_STOP_FIELD", clientId: stop.clientId, field, value })}
            onPickupsChange={(next) => dispatch({ type: "SET_STOP_PICKUPS", clientId: stop.clientId, guestClientIds: next })}
            onDropsChange={(next) => dispatch({ type: "SET_STOP_DROPS", clientId: stop.clientId, guestClientIds: next })}
            onMove={(direction) => dispatch({ type: "MOVE_STOP", clientId: stop.clientId, direction })}
            onRemove={() => dispatch({ type: "REMOVE_STOP", clientId: stop.clientId })}
          />
        ))}

        <Button variant="secondary" size="sm" className="w-fit" onPress={() => dispatch({ type: "ADD_STOP" })}>
          Add stop
        </Button>

        <ToLocationCard
          locationName={state.toLocationName}
          onLocationChange={(v) => dispatch({ type: "SET_TO_LOCATION", locationName: v })}
          arrivalAt={state.toArrivalAt}
          onArrivalAtChange={(v) => dispatch({ type: "SET_TO_ARRIVAL_AT", value: v })}
          guests={state.guests}
          eligibleDropIds={guestsAvailableToDropAt(state, null)}
          selectedDropIds={state.toDropoffGuestClientIds}
          onDropsChange={(next) => dispatch({ type: "SET_TO_DROPOFFS", guestClientIds: next })}
        />
        {neverDropped.length > 0 ? (
          <p className="text-sm text-warning">
            {neverDropped.length} guest{neverDropped.length === 1 ? "" : "s"} would never be dropped off — check the
            destination's drop-off list.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Assign a car and driver</h2>
        <CarAvailabilitySection
          cars={cars}
          isLoading={loadingAvailability}
          value={state.vehicleId}
          onChange={(vehicleId) => dispatch({ type: "SET_VEHICLE", vehicleId })}
        />
        <DriverAvailabilitySection
          drivers={drivers}
          isLoading={loadingAvailability}
          value={state.driverId}
          onChange={(driverId) => dispatch({ type: "SET_DRIVER", driverId })}
        />
      </section>

      {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}

      <Button type="submit" isDisabled={!canSubmit} isPending={submitting} className="w-fit">
        Plan journey
      </Button>
    </form>
  );
}
