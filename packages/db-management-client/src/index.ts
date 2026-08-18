// Typed client for the org's write path (AGENTS.md Section 4/9: "writes go through the
// db-management API, from every app... there is no trusted app exception").
//
// db-management is implemented as Supabase Edge Functions (supabase/functions/*), not a
// separate Vercel project — every department app already talks to the one shared Supabase
// project, so a new module adds one function + one typed method here, not a new deployment.
// This package is the single place every app imports from, so that contract can't drift
// per-app the way packages/auth's session logic can't (AGENTS.md Section 4).
//
// Every export takes an already-configured SupabaseClient (browser or server) — this
// package holds no env config and no service-role key of its own.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface GuestCheckInInput {
  fullName: string;
  /** Full E.164 phone number, country code included, e.g. "+919812345678". */
  phone: string;
}

interface GuestCheckInResponse {
  guestId: string;
  /** True if an existing guest row was matched by phone, false if a new one was created. */
  matched: boolean;
}

/**
 * Phone match-or-create data entry — NOT Supabase Auth. Guests are never created as
 * Supabase Auth users or given a session (explicit product decision); this just records
 * name+phone for tracking and returns a `guestId` the app remembers client-side (a plain
 * cookie, not a session) to identify "this browser is guest X" on later requests.
 */
export async function guestCheckIn(supabase: SupabaseClient, input: GuestCheckInInput) {
  const { data, error } = await supabase.functions.invoke<GuestCheckInResponse>("guest-signup", {
    body: input,
  });

  if (error || !data) {
    throw error ?? new Error("guest-signup returned no data");
  }

  return data;
}

export interface EmployeeSignInInput {
  employeeCode: string;
  /** Full E.164 phone number, country code included, e.g. "+919812345678". */
  phone: string;
}

interface EmployeeSignInResponse {
  employeeId: string;
}

/**
 * employee_code + phone match against `employees` — NOT Supabase Auth. No password, no
 * auth.users row, no session; mirrors guestCheckIn exactly. Unlike guests, this never
 * creates a row — employees are pre-existing HR records. Throws with the edge function's
 * actual message (e.g. "No active employee matches...") rather than a generic HTTP error.
 */
export async function employeeSignIn(supabase: SupabaseClient, input: EmployeeSignInInput) {
  const { data, error } = await supabase.functions.invoke<EmployeeSignInResponse>("employee-signin", {
    body: input,
  });

  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }

  return data;
}

export interface SubmitFeedbackInput {
  driverId: string;
  /** ISO date string (yyyy-mm-dd), defaults to today in the UI. */
  travelDate: string;
  /** 1-5 inclusive. */
  rating: number;
  description?: string;
  /** Present for guest submissions — exactly one of guestId/employeeId is required. */
  guestId?: string;
  /** Present for employee submissions — exactly one of guestId/employeeId is required. */
  employeeId?: string;
  /** Present for feedback on a planned ride — auto-approves; absent means unplanned (starts pending). */
  journeyId?: string;
}

interface SubmitFeedbackFunctionResponse {
  id: string;
  reviewStatus: "approved" | "pending";
}

/**
 * Invokes the `submit-feedback` edge function. Neither reviewer path carries a Supabase
 * session — `input.guestId` or `input.employeeId` identifies the reviewer instead (a
 * plain data label, not a verified identity — see the function's own comment).
 */
export async function submitFeedback(supabase: SupabaseClient, input: SubmitFeedbackInput) {
  const { data, error } = await supabase.functions.invoke<SubmitFeedbackFunctionResponse>("submit-feedback", {
    body: input,
  });

  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }

  return data;
}

/**
 * supabase.functions.invoke surfaces a non-2xx response as a generic FunctionsHttpError
 * whose `.context` is the raw Response — the structured `{ error }` body isn't parsed
 * automatically. Reads the real message back out; falls back to the generic one only if
 * the body isn't readable/JSON.
 */
async function extractErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // fall through to the generic message below
    }
  }
  return error instanceof Error ? error.message : "The request failed.";
}

// ---------------------------------------------------------------------------
// Journeys module (apps/admin/internal-portal) — every function below is Internal Portal
// admin-only; the edge function itself re-verifies that (supabase/functions/_shared/authz.ts)
// rather than trusting this client-side call to only ever be reachable by an admin.

export interface CreateCarInput {
  name: string;
  make: string;
  model: string;
  fuelType: "diesel" | "ev" | "petrol";
  registrationNumber: string;
}

interface CreateCarResponse {
  id: string;
}

/** Invokes `create-car`. Throws (with the function's error message) on a duplicate plate. */
export async function createCar(supabase: SupabaseClient, input: CreateCarInput) {
  const { data, error } = await supabase.functions.invoke<CreateCarResponse>("create-car", { body: input });
  if (error || !data) {
    throw error ?? new Error("create-car returned no data");
  }
  return data;
}

export interface UpdateCarStatusInput {
  vehicleId: string;
  status: "vacant" | "maintenance";
}

interface UpdateCarStatusResponse {
  id: string;
  status: string;
}

/** Invokes `update-car-status`. Throws if the car is on an active journey right now. */
export async function updateCarStatus(supabase: SupabaseClient, input: UpdateCarStatusInput) {
  const { data, error } = await supabase.functions.invoke<UpdateCarStatusResponse>("update-car-status", {
    body: input,
  });
  if (error || !data) {
    throw error ?? new Error("update-car-status returned no data");
  }
  return data;
}

export interface CreateDriverInput {
  fullName: string;
  /** Full E.164 phone number, country code included, e.g. "+919812345678". */
  phone: string;
  departmentId?: string;
  photoPath?: string;
}

interface CreateDriverResponse {
  id: string;
  driverCode: string;
}

/** Invokes `create-driver`. `driverCode` is allocated server-side off `driver_code_seq`. */
export async function createDriver(supabase: SupabaseClient, input: CreateDriverInput) {
  const { data, error } = await supabase.functions.invoke<CreateDriverResponse>("create-driver", {
    body: input,
  });
  if (error || !data) {
    throw error ?? new Error("create-driver returned no data");
  }
  return data;
}

interface UploadDriverPhotoResponse {
  photoPath: string;
}

/**
 * Invokes `upload-driver-photo` (multipart form body) — the only way a photo actually
 * lands in the `driver-photos` bucket, since no client role has a storage.objects write
 * policy there (service-role only). Call before `createDriver` and pass the returned
 * `photoPath` into it.
 */
export async function uploadDriverPhoto(supabase: SupabaseClient, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data, error } = await supabase.functions.invoke<UploadDriverPhotoResponse>("upload-driver-photo", {
    body: formData,
  });
  if (error || !data) {
    throw error ?? new Error("upload-driver-photo returned no data");
  }
  return data;
}

export interface JourneyGuestInput {
  /** Set when picked from an existing-guest match; omitted for a brand-new inline guest. */
  guestId?: string;
  fullName?: string;
  /** Full E.164 phone number — the correlation key stops' pickups/drops reference. */
  phone: string;
}

export interface JourneyStopInput {
  /** 0-based, contiguous: 0 is the origin, the highest value is the destination. */
  sequenceNo: number;
  role: "origin" | "stop" | "destination";
  locationName: string;
  /** ISO timestamp — a full date+time, not just a time-of-day (see the New Journey form's date design). */
  arrivalAt: string;
  /** Guest phones picked up here — must be empty for the destination stop. */
  pickups: string[];
  /** Guest phones dropped here — must be empty for the origin stop. */
  drops: string[];
}

export interface CreateJourneyInput {
  vehicleId: string;
  driverId: string;
  notes?: string;
  guests: JourneyGuestInput[];
  stops: JourneyStopInput[];
}

interface JourneyConflictDetail {
  resource: "vehicle" | "driver";
  journeyId: string;
  dateFrom: string;
  dateTo: string;
}

/** Thrown by createJourney/updateJourney when the car or driver is already booked over an overlapping window. */
export class JourneyConflictError extends Error {
  conflict: JourneyConflictDetail;
  constructor(conflict: JourneyConflictDetail) {
    super(
      `${conflict.resource} is already booked on an overlapping journey (${conflict.dateFrom} to ${conflict.dateTo})`,
    );
    this.conflict = conflict;
  }
}

interface CreateJourneyResponse {
  id: string;
}

/**
 * Invokes `create-journey`, which validates the route shape then delegates the atomic
 * multi-table write to public.create_journey via .rpc(). Throws JourneyConflictError on a
 * vehicle/driver double-booking (HTTP 409); throws a plain Error for any other failure
 * (validation, auth).
 */
export async function createJourney(supabase: SupabaseClient, input: CreateJourneyInput) {
  const { data, error } = await supabase.functions.invoke<CreateJourneyResponse>("create-journey", {
    body: input,
  });
  if (error) {
    const conflict = await extractConflict(error);
    if (conflict) {
      throw new JourneyConflictError(conflict);
    }
    throw error;
  }
  if (!data) {
    throw new Error("create-journey returned no data");
  }
  return data;
}

export interface UpdateJourneyInput extends CreateJourneyInput {
  journeyId: string;
}

interface UpdateJourneyResponse {
  id: string;
}

/** Invokes `update-journey`. Same conflict behavior as createJourney. */
export async function updateJourney(supabase: SupabaseClient, input: UpdateJourneyInput) {
  const { data, error } = await supabase.functions.invoke<UpdateJourneyResponse>("update-journey", {
    body: input,
  });
  if (error) {
    const conflict = await extractConflict(error);
    if (conflict) {
      throw new JourneyConflictError(conflict);
    }
    throw error;
  }
  if (!data) {
    throw new Error("update-journey returned no data");
  }
  return data;
}

export interface CancelJourneyInput {
  journeyId: string;
}

interface CancelJourneyResponse {
  id: string;
  status: "cancelled";
}

/** Invokes `cancel-journey`. Throws if the journey doesn't exist or is already completed. */
export async function cancelJourney(supabase: SupabaseClient, input: CancelJourneyInput) {
  const { data, error } = await supabase.functions.invoke<CancelJourneyResponse>("cancel-journey", {
    body: input,
  });
  if (error || !data) {
    throw error ?? new Error("cancel-journey returned no data");
  }
  return data;
}

export interface ApproveFeedbackInput {
  feedbackId: string;
  decision: "approved" | "rejected";
}

interface ApproveFeedbackResponse {
  id: string;
  reviewStatus: string;
}

/** Invokes `approve-feedback`. Throws if the row doesn't exist or isn't `pending`. */
export async function approveFeedback(supabase: SupabaseClient, input: ApproveFeedbackInput) {
  const { data, error } = await supabase.functions.invoke<ApproveFeedbackResponse>("approve-feedback", {
    body: input,
  });
  if (error || !data) {
    throw error ?? new Error("approve-feedback returned no data");
  }
  return data;
}

/**
 * `supabase.functions.invoke` surfaces a non-2xx response as a generic FunctionsHttpError
 * whose `.context` is the raw Response — the structured `{ error, conflict }` body isn't
 * parsed automatically, so this reads it back out for the 409 conflict case specifically.
 */
async function extractConflict(error: unknown): Promise<JourneyConflictDetail | null> {
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.json !== "function") {
    return null;
  }
  try {
    const body = await context.json();
    return body?.conflict ?? null;
  } catch {
    return null;
  }
}
