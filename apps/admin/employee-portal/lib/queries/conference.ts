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
}

/** Availability → the shapes the calendar views take. Only active rooms come back from the server. */
export function toCalendarData(availability: ConferenceAvailability): { rooms: ConferenceRoom[]; bookings: ConferenceBooking[] } {
  const rooms: ConferenceRoom[] = availability.rooms.map((r) => ({ ...r, status: "active" }));
  const nameOf = new Map(rooms.map((r) => [r.id, r.name]));
  const bookings: ConferenceBooking[] = availability.busy.map((b, i) => ({
    id: `busy-${b.roomId}-${b.startsAt}-${i}`,
    roomId: b.roomId,
    roomName: nameOf.get(b.roomId) ?? "Room",
    employeeId: "",
    employeeCode: "",
    employeeName: "",
    departmentName: null,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    seatingCount: 0,
    eventName: "Booked",
    eventDetails: null,
    status: "confirmed",
  }));
  return { rooms, bookings };
}
