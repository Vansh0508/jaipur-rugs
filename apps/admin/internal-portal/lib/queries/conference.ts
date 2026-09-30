import type { SupabaseClient } from "@supabase/supabase-js";

export type ConferenceRoomStatus = "active" | "inactive";
export type ConferenceBookingStatus = "confirmed" | "cancelled";

export interface ConferenceRoom {
  id: string;
  name: string;
  /** Seating limit; null when not recorded. */
  capacity: number | null;
  status: ConferenceRoomStatus;
}

/** What a booking is actually like right now — derived from its times, like journeys. */
export type ConferenceBookingPhase = "upcoming" | "ongoing" | "completed" | "cancelled";

export interface ConferenceBooking {
  id: string;
  roomId: string;
  roomName: string;
  /** The employee the room is booked for. */
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

export function bookingPhase(
  booking: Pick<ConferenceBooking, "status" | "startsAt" | "endsAt">,
  now: number = Date.now(),
): ConferenceBookingPhase {
  if (booking.status === "cancelled") return "cancelled";
  if (now >= new Date(booking.endsAt).getTime()) return "completed";
  if (now >= new Date(booking.startsAt).getTime()) return "ongoing";
  return "upcoming";
}

export async function listConferenceRooms(supabase: SupabaseClient): Promise<ConferenceRoom[]> {
  const { data, error } = await supabase.from("conference_rooms").select("id, name, capacity, status").order("name");
  if (error) throw error;
  return (data ?? []) as ConferenceRoom[];
}

// conference_bookings has two FKs to employees (employee_id = who it's for, created_by =
// the admin who entered it), so the embed names its constraint to pick the right one.
const BOOKING_SELECT = `
  id, room_id, employee_id, starts_at, ends_at, seating_count, event_name, event_details, status,
  room:conference_rooms(name),
  employee:employees!conference_bookings_employee_id_fkey(full_name, employee_code, department:departments!employees_department_id_fkey(name))
`;

interface RawBookingRow {
  id: string;
  room_id: string;
  employee_id: string;
  starts_at: string;
  ends_at: string;
  seating_count: number;
  event_name: string;
  event_details: string | null;
  status: ConferenceBookingStatus;
  room: { name: string } | null;
  employee: { full_name: string; employee_code: string; department: { name: string } | null } | null;
}

function toBooking(row: RawBookingRow): ConferenceBooking {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room?.name ?? "Unknown room",
    employeeId: row.employee_id,
    employeeCode: row.employee?.employee_code ?? "",
    employeeName: row.employee?.full_name ?? "Unknown employee",
    departmentName: row.employee?.department?.name ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    seatingCount: row.seating_count,
    eventName: row.event_name,
    eventDetails: row.event_details,
    status: row.status,
  };
}

/**
 * Every booking (confirmed and cancelled) whose time overlaps [fromIso, toIso), earliest
 * first. Overlap rather than "starts inside", so a booking that began before the window
 * but runs into it is still returned.
 */
export async function listConferenceBookings(supabase: SupabaseClient, fromIso: string, toIso: string) {
  const { data, error } = await supabase
    .from("conference_bookings")
    .select(BOOKING_SELECT)
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso)
    .order("starts_at");
  if (error) throw error;
  return ((data ?? []) as unknown as RawBookingRow[]).map(toBooking);
}
