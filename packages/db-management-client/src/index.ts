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
  /**
   * Drives the recovery cascade after a first call throws EmployeeNotFoundError (i.e. the
   * typed employee_code matched zero rows). Never set any of these speculatively — a code
   * that exists but doesn't match the phone/status is a wrong-credentials case, and the
   * edge function won't recover that:
   *
   *   - "confirmPhoneMatch" — call after EmployeePhoneMatchPendingError, once the caller's
   *     own confirm/cancel popup was accepted. Patches only what's missing and logs in.
   *   - "lookupEmail" — call after EmployeeNotFoundError, with `email` set, to search by
   *     email once neither code nor phone matched anything.
   *   - "confirmEmailMatch" — call after EmployeeEmailMatchPendingError (same `email`),
   *     once confirmed. Patches only what's missing and logs in.
   *   - "createNew" — call after EmployeeEmailNotFoundError, with `email` (already known
   *     from the lookupEmail step) and a newly-collected `fullName`. Creates a genuinely
   *     new row with a server-allocated employee_code — never the one originally typed.
   */
  action?: "confirmPhoneMatch" | "lookupEmail" | "confirmEmailMatch" | "createNew";
  fullName?: string;
  email?: string;
}

interface EmployeeSignInResponse {
  employeeId: string;
  /** Present only when a new row was just created — the server-allocated employee_code
   * (next_employee_code()), not whatever the caller originally typed to sign in with. */
  employeeCode?: string;
  created?: boolean;
}

/** No `employees` row has the given employee_code, and none matches the given phone either. Next step: ask for an email and call again with action: "lookupEmail". */
export class EmployeeNotFoundError extends Error {
  constructor() {
    super("No employee found with that code.");
  }
}

/** The code didn't match, but an existing row's phone does. Show a plain confirm/cancel popup, then call again with action: "confirmPhoneMatch". */
export class EmployeePhoneMatchPendingError extends Error {
  constructor() {
    super("A record already exists for this phone number.");
  }
}

/** Neither the code, the phone, nor the given email matched anything. This is genuinely a new person — collect a full name and call again with action: "createNew". */
export class EmployeeEmailNotFoundError extends Error {
  constructor() {
    super("No employee found with that email.");
  }
}

/** The given email matches an existing row. Show a plain confirm/cancel popup, then call again with action: "confirmEmailMatch". */
export class EmployeeEmailMatchPendingError extends Error {
  constructor() {
    super("A record already exists for this email.");
  }
}

const EMPLOYEE_SIGN_IN_ERROR_CLASSES = {
  not_found: EmployeeNotFoundError,
  phone_match_pending: EmployeePhoneMatchPendingError,
  email_not_found: EmployeeEmailNotFoundError,
  email_match_pending: EmployeeEmailMatchPendingError,
} as const;

/**
 * employee_code + phone match against `employees` — NOT Supabase Auth. No password, no
 * auth.users row, no session. When the code matches nothing, the edge function runs a
 * recovery cascade (phone, then email, then offering to create a new row) rather than
 * failing outright — each step throws one of the typed errors above so the caller can
 * drive its own popups; see EmployeeSignInInput's `action` docs for the exact sequence.
 * Throws a plain Error with the edge function's actual message for every other failure
 * (e.g. "No active employee matches..." for a real code with the wrong phone).
 */
export async function employeeSignIn(supabase: SupabaseClient, input: EmployeeSignInInput) {
  const { data, error } = await supabase.functions.invoke<EmployeeSignInResponse>("employee-signin", {
    body: input,
  });

  if (error || !data) {
    const { code, message } = await parseEmployeeSignInError(error);
    const ErrorClass = code ? EMPLOYEE_SIGN_IN_ERROR_CLASSES[code as keyof typeof EMPLOYEE_SIGN_IN_ERROR_CLASSES] : undefined;
    if (ErrorClass) {
      throw new ErrorClass();
    }
    throw new Error(message);
  }

  return data;
}

/**
 * Reads a FunctionsHttpError's body exactly once, returning both the raw `error` string
 * (used to pick one of the typed errors above) and a display-ready message (used as a
 * plain Error's message for every other failure). Response bodies can only be read once,
 * so this must not call context.json() more than a single time per error.
 */
async function parseEmployeeSignInError(error: unknown): Promise<{ code: string | null; message: string }> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (typeof body?.error === "string") {
        return { code: body.error, message: body.error };
      }
    } catch {
      // fall through to the generic message below
    }
  }
  return { code: null, message: error instanceof Error ? error.message : "The request failed." };
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

// ---------------------------------------------------------------------------
// Hub module (apps/hub) — sign-up/onboarding/profile and Team-page role/manager admin.
// See db/team-members/006_hub_onboarding_and_admin.sql.

export interface EmployeeSignUpInput {
  email: string;
  password: string;
  fullName: string;
}

interface EmployeeSignUpResponse {
  employeeId: string;
}

/**
 * Invokes `employee-signup`, which creates the Supabase Auth user itself (via the Admin
 * API) rather than the caller using `supabase.auth.signUp()` directly — see the function's
 * own comment for why. This never establishes a session; call
 * `supabase.auth.signInWithPassword` with the same credentials right after, to satisfy the
 * "auto-login after first sign-up" requirement.
 */
export async function employeeSignUp(supabase: SupabaseClient, input: EmployeeSignUpInput) {
  const { data, error } = await supabase.functions.invoke<EmployeeSignUpResponse>("employee-signup", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface UpdateOwnProfileInput {
  phone?: string;
  employmentType?: "full_time" | "part_time" | "contract" | "intern" | "consultant";
  departmentId?: string;
  joinedAt?: string;
  avatarPath?: string;
}

interface UpdateOwnProfileResponse {
  employeeId: string;
}

/**
 * Invokes `update-own-profile` — used both by the onboarding wizard's last step (which
 * also marks onboarding complete server-side) and later edits from /profile.
 */
export async function updateOwnProfile(supabase: SupabaseClient, input: UpdateOwnProfileInput) {
  const { data, error } = await supabase.functions.invoke<UpdateOwnProfileResponse>("update-own-profile", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

interface UploadEmployeeAvatarResponse {
  avatarPath: string;
}

/** Invokes `upload-employee-avatar` (multipart form body) — self-service, unlike uploadDriverPhoto. */
export async function uploadEmployeeAvatar(supabase: SupabaseClient, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data, error } = await supabase.functions.invoke<UploadEmployeeAvatarResponse>("upload-employee-avatar", {
    body: formData,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface InviteEmployeeInput {
  fullName: string;
  email: string;
  departmentId?: string;
  managerId?: string;
  primaryRoleId?: string;
  employmentType?: "full_time" | "part_time" | "contract" | "intern" | "consultant";
}

interface InviteEmployeeResponse {
  employeeId: string;
  employeeCode: string;
}

/** Invokes `invite-employee` — the Team page's "Add team member." Requires `employees.write`. */
export async function inviteEmployee(supabase: SupabaseClient, input: InviteEmployeeInput) {
  const { data, error } = await supabase.functions.invoke<InviteEmployeeResponse>("invite-employee", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface UpdateEmployeeInput {
  employeeId: string;
  departmentId?: string | null;
  managerId?: string | null;
  primaryRoleId?: string | null;
  employmentType?: "full_time" | "part_time" | "contract" | "intern" | "consultant";
  status?: "invited" | "active" | "inactive" | "on_leave" | "offboarded";
}

interface UpdateEmployeeResponse {
  employeeId: string;
}

/** Invokes `update-employee` — the Team page's row-level edit (department/manager/role/status). Requires `employees.write`. */
export async function updateEmployee(supabase: SupabaseClient, input: UpdateEmployeeInput) {
  const { data, error } = await supabase.functions.invoke<UpdateEmployeeResponse>("update-employee", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

// ---------------------------------------------------------------------------
// Orders module (apps/atlas) — see db/orders/README.md. Every write here goes through a
// service-role Edge Function (no client, including admin, has an insert/update RLS
// policy on any orders-module table) — same posture as the journeys module above.

export interface UpdateOrderStageInput {
  orderId: string;
  /** Must match a `stages.code` value — see db/orders/001_orders_core_schema.sql's seed. */
  stageCode: string;
}

interface UpdateOrderStageResponse {
  orderId: string;
  stageCode: string;
}

/** Invokes `orders-update-stage`. Production department access or orders.write.all (admin) only. */
export async function updateOrderStage(supabase: SupabaseClient, input: UpdateOrderStageInput) {
  const { data, error } = await supabase.functions.invoke<UpdateOrderStageResponse>("orders-update-stage", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface SetShippingDetailInput {
  orderId: string;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  foldable?: boolean | null;
  carrier?: string | null;
  quoteStatus?: "not_requested" | "requested" | "quoted" | "booked";
  notes?: string | null;
}

interface SetShippingDetailResponse {
  id: string;
  orderId: string;
}

/**
 * Invokes `orders-set-shipping-detail`. Only the fields present in `input` are changed —
 * omitted fields keep whatever's already stored (see the function's own comment); pass
 * `null` explicitly to clear a field. Production or shipping department access, or
 * orders.write.all (admin).
 */
export async function setShippingDetail(supabase: SupabaseClient, input: SetShippingDetailInput) {
  const { data, error } = await supabase.functions.invoke<SetShippingDetailResponse>(
    "orders-set-shipping-detail",
    { body: input },
  );
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface GrantCustomerCodesInput {
  /** The salesperson's own login email — must already have signed up (see
   * employee-signup); this only grants access, it never creates an account. */
  employeeEmail: string;
  /** ERP `Customer No_` codes this salesperson/territory head should see — at least one required. */
  customerNos: string[];
}

interface GrantCustomerCodesResponse {
  employeeId: string;
  granted: number;
}

/**
 * Invokes `merchants-invite` — kept its original name (renaming would ripple through
 * the deployed function's slug too) though it no longer creates a Clerk-linkable row.
 * "Merchant" here means a territory head/B2B salesperson (Ayaan's correction,
 * 2026-09-01), already a normal employee — this just grants that existing employee
 * visibility into specific ERP customer codes. orders.write.all (admin) only.
 */
export async function grantCustomerCodes(supabase: SupabaseClient, input: GrantCustomerCodesInput) {
  const { data, error } = await supabase.functions.invoke<GrantCustomerCodesResponse>("merchants-invite", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

interface AddOwnSalespersonCodesResponse {
  employeeId: string;
  added: string[];
}

/**
 * Invokes `salesperson-codes-add` — self-service, always the CALLER'S OWN account
 * (resolved server-side from their session, never a client-supplied id). No approval
 * step (explicit product decision, 2026-09-02): there's no reliable way to derive a
 * name<->code mapping from the ERP feed, so a person typing in their own already-known
 * code is the real answer — see db/orders/010_salesperson_codes_self_service.sql.
 */
export async function addOwnSalespersonCodes(supabase: SupabaseClient, codes: string[]) {
  const { data, error } = await supabase.functions.invoke<AddOwnSalespersonCodesResponse>(
    "salesperson-codes-add",
    { body: { codes } },
  );
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

// ---------------------------------------------------------------------------
// Orders workflow layer (db/orders/004) — the structured replacement for the
// order@/mzpreview@ email relay. Prototyped and load-tested in a local preview tool
// against the real live ERP feed before this schema/these functions were written; see
// db/orders/README.md and apps/atlas/README.md.

export interface CreateOrderRequestInput {
  orderId: string;
  requestTypeCode: "process_order" | "create_warehouse" | "post_warehouse" | "qc_review";
  /** Required for create_warehouse; optional elsewhere — there is no accounts department, the requester supplies it. */
  psft?: string;
  note?: string;
}

interface CreateOrderRequestResponse {
  request: { id: string; status: "open" | "blocked"; blockedReason: string | null; psft: string | null; warehouseNo: string | null; createdAt: string };
  qcLocation: string | null;
}

/** Invokes `orders-create-request`. Open to any active employee — filing is the write-side equivalent of sending an email today. */
export async function createOrderRequest(supabase: SupabaseClient, input: CreateOrderRequestInput) {
  const { data, error } = await supabase.functions.invoke<CreateOrderRequestResponse>("orders-create-request", { body: input });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface ActionOrderRequestInput {
  requestId: string;
  status: "in_progress" | "done" | "rejected";
  /** Required to mark a process_order request done — the ack IS the number. */
  soNo?: string;
  /** Required to mark a create_warehouse request done — referenced by every later step. */
  warehouseNo?: string;
  note?: string;
}

/** Invokes `orders-action-request`. Gated by the request type's owning department, or orders.write.all (admin). */
export async function actionOrderRequest(supabase: SupabaseClient, input: ActionOrderRequestInput) {
  const { data, error } = await supabase.functions.invoke<{ requestId: string; status: string }>("orders-action-request", { body: input });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

/** Invokes `orders-mark-request-seen` — the receipt that kills "maine dekha nahi." Open to any active employee. */
export async function markOrderRequestSeen(supabase: SupabaseClient, requestId: string) {
  const { data, error } = await supabase.functions.invoke<{ ok: true }>("orders-mark-request-seen", { body: { requestId } });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface RecordOrderMilestoneInput {
  orderId: string;
  milestone: "qc_done" | "packed" | "dispatched" | "awb_issued";
  /** For awb_issued, this IS the AWB number, not a comment — the tracking link is generated from it. */
  note?: string;
}

/** Invokes `orders-record-milestone`. Gated to production/shipping/nav access, or orders.write.all (admin). */
export async function recordOrderMilestone(supabase: SupabaseClient, input: RecordOrderMilestoneInput) {
  const { data, error } = await supabase.functions.invoke<{ ok: true }>("orders-record-milestone", { body: input });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

interface EscalateOrderResponse {
  to: string;
  level: number;
  nextLevel: string | null;
}

/**
 * Invokes `orders-escalate-order` — climbs the real named chain (Amit Dagar → Vishal
 * Verma & Sumit Yadav → the Director) one rung per call, per order. Throws once already
 * at the top level ("nowhere further to go") rather than a generic rate limit.
 */
export async function escalateOrder(supabase: SupabaseClient, orderId: string, reason?: string) {
  const { data, error } = await supabase.functions.invoke<EscalateOrderResponse>("orders-escalate-order", { body: { orderId, reason } });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
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
