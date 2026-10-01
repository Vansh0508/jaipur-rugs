import type { CreateJourneyInput } from "@jaipur-rugs/db-management-client";

// Pure state logic for JourneyBuilder — driver-app-new's JourneyBuilder rules, kept out of
// the component so the (fiddly) pickup/drop eligibility and schedule math live in one place.

/**
 * One entry in the guest pool — a guest or an employee (the pool row's Guest/Employee
 * switch). Guests: `guestId` is set when matched to an existing guest, else created by
 * phone on save. Employees: `employeeId` links the existing employees row (no copy made).
 */
export interface PoolGuest {
  clientId: string;
  kind: "guest" | "employee";
  guestId: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  departmentName: string | null;
  name: string;
  /** Guests: full E.164, e.g. "+919812345678" (ui-kit PhoneInput's output). Employees: whatever is on file, often "". */
  phone: string;
}

export interface BuilderStop {
  clientId: string;
  location: string;
  /** "HH:mm" (24h) — the date comes from the journey's Date & Time, see buildSchedule. */
  time: string;
  pickupIds: string[];
  dropIds: string[];
}

let counter = 0;
export function newClientId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** A new pool row — Employee by default; the row's Guest/Employee dropdown switches it. */
export function emptyGuest(kind: PoolGuest["kind"] = "employee"): PoolGuest {
  return { clientId: newClientId("guest"), kind, guestId: null, employeeId: null, employeeCode: null, departmentName: null, name: "", phone: "" };
}

/** The key stops reference a passenger by (create-journey contract): phone for guests, "employee:<id>" for employees. */
export function passengerKey(g: PoolGuest) {
  return g.kind === "employee" ? `employee:${g.employeeId}` : g.phone;
}

export function emptyStop(): BuilderStop {
  return { clientId: newClientId("stop"), location: "", time: "", pickupIds: [], dropIds: [] };
}

/** Everyone picked up (start or any stop) and not dropped at an intermediate stop — auto-dropped at the destination. */
export function destinationGuestIds(pool: PoolGuest[], startIds: string[], stops: BuilderStop[]) {
  const picked = new Set([...startIds, ...stops.flatMap((s) => s.pickupIds)]);
  const dropped = new Set(stops.flatMap((s) => s.dropIds));
  // Pool order, so the destination list reads the same way the pool does.
  return pool.map((g) => g.clientId).filter((id) => picked.has(id) && !dropped.has(id));
}

/** Start pickups: anyone not already picked up at an intermediate stop (selected ones stay visible for deselection). */
export function startEligible(pool: PoolGuest[], startIds: string[], stops: BuilderStop[]) {
  const pickedAtStops = new Set(stops.flatMap((s) => s.pickupIds));
  return pool.filter((g) => !pickedAtStops.has(g.clientId) || startIds.includes(g.clientId));
}

/**
 * At intermediate stop `index`: pickup = not already picked up at the start or any OTHER
 * stop; drop = currently in the vehicle (picked up at or before this stop, not dropped at
 * an earlier one). Selected guests always stay listed so they can be deselected.
 */
export function stopEligible(pool: PoolGuest[], startIds: string[], stops: BuilderStop[], index: number) {
  const stop = stops[index]!;
  const pickedElsewhere = new Set(startIds);
  stops.forEach((s, j) => j !== index && s.pickupIds.forEach((id) => pickedElsewhere.add(id)));

  const inVehicle = new Set(startIds);
  stops.forEach((s, j) => j <= index && s.pickupIds.forEach((id) => inVehicle.add(id)));
  stops.forEach((s, j) => j < index && s.dropIds.forEach((id) => inVehicle.delete(id)));

  return {
    forPickup: pool.filter((g) => !pickedElsewhere.has(g.clientId) || stop.pickupIds.includes(g.clientId)),
    forDrop: pool.filter((g) => inVehicle.has(g.clientId) || stop.dropIds.includes(g.clientId)),
  };
}

export function isGuestInRoute(clientId: string, startIds: string[], stops: BuilderStop[]) {
  return startIds.includes(clientId) || stops.some((s) => s.pickupIds.includes(clientId) || s.dropIds.includes(clientId));
}

/** Guests referenced by the route that are no longer in the pool — purged when the pool is saved. */
export function withoutMissingGuests(poolIds: Set<string>, startIds: string[], stops: BuilderStop[]) {
  return {
    startIds: startIds.filter((id) => poolIds.has(id)),
    stops: stops.map((s) => ({ ...s, pickupIds: s.pickupIds.filter((id) => poolIds.has(id)), dropIds: s.dropIds.filter((id) => poolIds.has(id)) })),
  };
}

function atTime(base: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h!, m!, 0, 0);
  return d;
}

/**
 * Real arrival timestamps for origin → stops → destination. This schema stores a full
 * timestamptz per stop (driver-app-new stored a free-text time-of-day), so: the journey's
 * Date & Time gives the day; the origin's time defaults to that same time; every later
 * stop's time-of-day is placed on the same day as the previous stop, rolling to the next
 * day when it's earlier (an overnight trip). Returns null entries for missing times.
 */
export function buildSchedule(rideDate: string, startTime: string, stopTimes: string[], endTime: string): (Date | null)[] {
  if (!rideDate) return [null, ...stopTimes.map(() => null), null];
  const base = new Date(rideDate);
  const origin = atTime(base, startTime || rideDate.slice(11, 16));
  const result: (Date | null)[] = [origin];
  let previous = origin;
  for (const time of [...stopTimes, endTime]) {
    if (!time) {
      result.push(null);
      continue;
    }
    let next = atTime(previous, time);
    if (next < previous) next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
    result.push(next);
    previous = next;
  }
  return result;
}

const E164 = /^\+[1-9]\d{6,14}$/;

export interface BuilderValues {
  carId: string;
  driverId: string;
  rideDate: string;
  startPoint: string;
  startTime: string;
  endPoint: string;
  endTime: string;
  pool: PoolGuest[];
  startIds: string[];
  stops: BuilderStop[];
}

export function validatePool(pool: PoolGuest[]) {
  const errors: Record<string, string> = {};
  const seenPhones = new Set<string>();
  const seenEmployees = new Set<string>();
  for (const g of pool) {
    const key = `guest_${g.clientId}`;
    if (g.kind === "employee") {
      if (!g.employeeId) errors[key] = "Search and select an employee";
      else if (seenEmployees.has(g.employeeId)) errors[key] = "This employee is already in the pool";
      if (g.employeeId) seenEmployees.add(g.employeeId);
      continue;
    }
    if (!g.name.trim() || !g.phone) errors[key] = "Enter guest name and phone number";
    else if (!E164.test(g.phone)) errors[key] = "Enter a valid phone number";
    else if (seenPhones.has(g.phone)) errors[key] = "This phone number is already in the pool";
    if (g.phone) seenPhones.add(g.phone);
  }
  return errors;
}

export function validate(values: BuilderValues) {
  const errors: Record<string, string> = {};
  if (!values.carId) errors.car = "Select a car";
  if (!values.driverId) errors.driver = "Select a driver";
  if (!values.rideDate) errors.rideDate = "Pick a date and time";
  if (!values.startPoint.trim()) errors.start = "Enter a start point";
  if (!values.endPoint.trim()) errors.end = "Enter an end point";
  if (!values.endTime) errors.endTime = "Enter the arrival time";
  if (values.pool.length === 0) errors.guests = "Add at least one guest to the journey";
  Object.assign(errors, validatePool(values.pool));
  for (const s of values.stops) {
    if (!s.location.trim()) errors[`stop_${s.clientId}_location`] = "Enter a location";
    if (!s.time) errors[`stop_${s.clientId}_time`] = "Enter a time";
  }
  const pickups = values.startIds.length + values.stops.reduce((n, s) => n + s.pickupIds.length, 0);
  if (values.pool.length > 0 && pickups === 0) errors.route = "Select at least one guest to pick up along the route";
  return errors;
}

/** The create-journey payload (see supabase/functions/create-journey for the contract). */
export function buildPayload(values: BuilderValues, schedule: Date[]): Omit<CreateJourneyInput, "vehicleId" | "driverId"> {
  const keyOf = new Map(values.pool.map((g) => [g.clientId, passengerKey(g)]));
  const phones = (ids: string[]) => ids.map((id) => keyOf.get(id)!).filter(Boolean);
  const last = values.stops.length + 1;
  return {
    guests: values.pool.map((g) =>
      g.kind === "employee"
        ? { employeeId: g.employeeId!, key: passengerKey(g) }
        : { guestId: g.guestId ?? undefined, fullName: g.name.trim(), phone: g.phone },
    ),
    stops: [
      { sequenceNo: 0, role: "origin", locationName: values.startPoint.trim(), arrivalAt: schedule[0]!.toISOString(), pickups: phones(values.startIds), drops: [] },
      ...values.stops.map((s, i) => ({
        sequenceNo: i + 1,
        role: "stop" as const,
        locationName: s.location.trim(),
        arrivalAt: schedule[i + 1]!.toISOString(),
        pickups: phones(s.pickupIds),
        drops: phones(s.dropIds),
      })),
      {
        sequenceNo: last,
        role: "destination",
        locationName: values.endPoint.trim(),
        arrivalAt: schedule[last]!.toISOString(),
        pickups: [],
        drops: phones(destinationGuestIds(values.pool, values.startIds, values.stops)),
      },
    ],
  };
}
