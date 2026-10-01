import type { ConferenceAvailability } from "@jaipur-rugs/db-management-client";

// The conference calendar components are copied from apps/admin/internal-portal, and read the
// same ConferenceRoom / ConferenceBooking shapes. Here there are no real bookings to read —
// only busy time ranges from conference-availability — so each busy range is turned into a
// "Booked" block with no one's name on it, and the copied views render it unchanged.

export type ConferenceRoomStatus = "active" | "inactive";
export type ConferenceBookingStatus = "confirmed" | "cancelled";

export interface ConferenceRoom {
  id: string;
  name: string;
  capacity: number | null;
  /** Where the room is ("2nd floor, Admin block"); null when not given. */
  description: string | null;
  status: ConferenceRoomStatus;
}

export interface ConferenceBooking {
  id: string;
  roomId: string;
  roomName: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  startsAt: string;
  endsAt: string;
  seatingCount: number;
  eventName: string;
  eventDetails: string | null;
  status: ConferenceBookingStatus;
  /** Set on a pending request's block (drawn dashed, "Requested — pending"). */
  pendingRequestId?: string;
}

/**
 * Availability → the shapes the calendar views take. Only active rooms come back from the
 * server. `bookings` are the confirmed busy blocks ("Booked"); `pending` are requests waiting on
 * the admin team ("Requested — pending", drawn dashed). Neither carries anyone's name.
 */
export function toCalendarData(availability: ConferenceAvailability): {
  rooms: ConferenceRoom[];
  bookings: ConferenceBooking[];
  pending: ConferenceBooking[];
} {
  const rooms: ConferenceRoom[] = availability.rooms.map((r) => ({ ...r, status: "active" }));
  const nameOf = new Map(rooms.map((r) => [r.id, r.name]));
  const block = (kind: "busy" | "pending") => (b: { roomId: string; startsAt: string; endsAt: string }, i: number): ConferenceBooking => ({
    id: `${kind}-${b.roomId}-${b.startsAt}-${i}`,
    roomId: b.roomId,
    roomName: nameOf.get(b.roomId) ?? "Room",
    employeeId: "",
    employeeCode: "",
    employeeName: "",
    departmentName: null,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    seatingCount: 0,
    eventName: kind === "busy" ? "Booked" : "Requested — pending",
    eventDetails: null,
    status: "confirmed",
    ...(kind === "pending" ? { pendingRequestId: `pending-${i}` } : {}),
  });
  return { rooms, bookings: availability.busy.map(block("busy")), pending: (availability.pending ?? []).map(block("pending")) };
}
