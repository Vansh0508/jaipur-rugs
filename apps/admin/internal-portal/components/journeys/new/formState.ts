// The New Journey form's client-side state — a single reducer rather than scattered
// useStates, because removing a guest must cascade-purge them from every stop's
// pickup/drop lists, and reordering stops must re-derive which guests are eligible
// pickups/drops at each point. Keeping that cascade logic in one place (this file) avoids
// duplicated useEffects across sibling section components.

export interface GuestEntry {
  clientId: string;
  /** Set when picked from an existing-guest match; null means a brand-new inline guest. */
  guestId: string | null;
  fullName: string;
  phone: string;
}

export interface StopEntry {
  clientId: string;
  locationName: string;
  /** datetime-local value (yyyy-MM-ddTHH:mm) — a full date+time, not just a time-of-day. */
  arrivalAt: string;
  pickupGuestClientIds: string[];
  dropoffGuestClientIds: string[];
}

export interface NewJourneyFormState {
  dateRange: { start: string; end: string };
  guests: GuestEntry[];
  fromLocationName: string;
  /** datetime-local — origin is always a pickup point, so it always needs a time. */
  fromArrivalAt: string;
  fromPickupGuestClientIds: string[];
  stops: StopEntry[];
  toLocationName: string;
  /** datetime-local — destination is always a drop point, so it always needs a time. */
  toArrivalAt: string;
  toDropoffGuestClientIds: string[];
  vehicleId: string | null;
  driverId: string | null;
}

export const initialFormState: NewJourneyFormState = {
  dateRange: { start: "", end: "" },
  guests: [],
  fromLocationName: "",
  fromArrivalAt: "",
  fromPickupGuestClientIds: [],
  stops: [],
  toLocationName: "",
  toArrivalAt: "",
  toDropoffGuestClientIds: [],
  vehicleId: null,
  driverId: null,
};

export type NewJourneyFormAction =
  | { type: "SET_DATE_RANGE"; range: { start: string; end: string } }
  | { type: "ADD_GUEST" }
  | { type: "SET_GUEST"; clientId: string; guest: Partial<Omit<GuestEntry, "clientId">> }
  | { type: "REMOVE_GUEST"; clientId: string }
  | { type: "SET_FROM_LOCATION"; locationName: string }
  | { type: "SET_FROM_ARRIVAL_AT"; value: string }
  | { type: "SET_FROM_PICKUPS"; guestClientIds: string[] }
  | { type: "ADD_STOP" }
  | { type: "REMOVE_STOP"; clientId: string }
  | { type: "MOVE_STOP"; clientId: string; direction: "up" | "down" }
  | { type: "SET_STOP_FIELD"; clientId: string; field: "locationName" | "arrivalAt"; value: string }
  | { type: "SET_STOP_PICKUPS"; clientId: string; guestClientIds: string[] }
  | { type: "SET_STOP_DROPS"; clientId: string; guestClientIds: string[] }
  | { type: "SET_TO_LOCATION"; locationName: string }
  | { type: "SET_TO_ARRIVAL_AT"; value: string }
  | { type: "SET_TO_DROPOFFS"; guestClientIds: string[] }
  | { type: "SET_VEHICLE"; vehicleId: string | null }
  | { type: "SET_DRIVER"; driverId: string | null };

let clientIdCounter = 0;
export function newClientId(prefix: string) {
  clientIdCounter += 1;
  return `${prefix}-${clientIdCounter}`;
}

export function newJourneyFormReducer(
  state: NewJourneyFormState,
  action: NewJourneyFormAction,
): NewJourneyFormState {
  switch (action.type) {
    case "SET_DATE_RANGE":
      return { ...state, dateRange: action.range };

    case "ADD_GUEST":
      return {
        ...state,
        guests: [...state.guests, { clientId: newClientId("guest"), guestId: null, fullName: "", phone: "" }],
      };

    case "SET_GUEST":
      return {
        ...state,
        guests: state.guests.map((g) => (g.clientId === action.clientId ? { ...g, ...action.guest } : g)),
      };

    case "REMOVE_GUEST": {
      const id = action.clientId;
      return {
        ...state,
        guests: state.guests.filter((g) => g.clientId !== id),
        fromPickupGuestClientIds: state.fromPickupGuestClientIds.filter((c) => c !== id),
        toDropoffGuestClientIds: state.toDropoffGuestClientIds.filter((c) => c !== id),
        stops: state.stops.map((s) => ({
          ...s,
          pickupGuestClientIds: s.pickupGuestClientIds.filter((c) => c !== id),
          dropoffGuestClientIds: s.dropoffGuestClientIds.filter((c) => c !== id),
        })),
      };
    }

    case "SET_FROM_LOCATION":
      return { ...state, fromLocationName: action.locationName };

    case "SET_FROM_ARRIVAL_AT":
      return { ...state, fromArrivalAt: action.value };

    case "SET_FROM_PICKUPS":
      return { ...state, fromPickupGuestClientIds: action.guestClientIds };

    case "ADD_STOP":
      return {
        ...state,
        stops: [
          ...state.stops,
          { clientId: newClientId("stop"), locationName: "", arrivalAt: "", pickupGuestClientIds: [], dropoffGuestClientIds: [] },
        ],
      };

    case "REMOVE_STOP":
      return { ...state, stops: state.stops.filter((s) => s.clientId !== action.clientId) };

    case "MOVE_STOP": {
      const index = state.stops.findIndex((s) => s.clientId === action.clientId);
      if (index === -1) return state;
      const swapWith = action.direction === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= state.stops.length) return state;
      const stops = [...state.stops];
      const current = stops[index]!;
      const swapTarget = stops[swapWith]!;
      stops[index] = swapTarget;
      stops[swapWith] = current;
      return { ...state, stops };
    }

    case "SET_STOP_FIELD":
      return {
        ...state,
        stops: state.stops.map((s) => (s.clientId === action.clientId ? { ...s, [action.field]: action.value } : s)),
      };

    case "SET_STOP_PICKUPS":
      return {
        ...state,
        stops: state.stops.map((s) =>
          s.clientId === action.clientId ? { ...s, pickupGuestClientIds: action.guestClientIds } : s,
        ),
      };

    case "SET_STOP_DROPS":
      return {
        ...state,
        stops: state.stops.map((s) =>
          s.clientId === action.clientId ? { ...s, dropoffGuestClientIds: action.guestClientIds } : s,
        ),
      };

    case "SET_TO_LOCATION":
      return { ...state, toLocationName: action.locationName };

    case "SET_TO_ARRIVAL_AT":
      return { ...state, toArrivalAt: action.value };

    case "SET_TO_DROPOFFS":
      return { ...state, toDropoffGuestClientIds: action.guestClientIds };

    case "SET_VEHICLE":
      return { ...state, vehicleId: action.vehicleId };

    case "SET_DRIVER":
      return { ...state, driverId: action.driverId };

    default:
      return state;
  }
}

/** Guests picked up somewhere before (and including) the given point, not yet dropped. */
export function guestsAvailableToDropAt(state: NewJourneyFormState, uptoStopClientId: string | null): string[] {
  const pickedUp = new Set(state.fromPickupGuestClientIds);
  const dropped = new Set<string>();
  for (const stop of state.stops) {
    if (stop.clientId === uptoStopClientId) break;
    stop.pickupGuestClientIds.forEach((id) => pickedUp.add(id));
    stop.dropoffGuestClientIds.forEach((id) => dropped.add(id));
  }
  return [...pickedUp].filter((id) => !dropped.has(id));
}

/** Guests not yet picked up anywhere before the given point. */
export function guestsAvailableToPickAt(state: NewJourneyFormState, uptoStopClientId: string | null): string[] {
  const pickedUp = new Set(state.fromPickupGuestClientIds);
  for (const stop of state.stops) {
    if (stop.clientId === uptoStopClientId) break;
    stop.pickupGuestClientIds.forEach((id) => pickedUp.add(id));
  }
  return state.guests.map((g) => g.clientId).filter((id) => !pickedUp.has(id));
}

/** Guests who've been picked up but never dropped by the end of the route — used for the TO stop's default checked set and a submit-time warning. */
export function guestsNeverDropped(state: NewJourneyFormState): string[] {
  return guestsAvailableToDropAt(state, null).filter((id) => !state.toDropoffGuestClientIds.includes(id));
}
