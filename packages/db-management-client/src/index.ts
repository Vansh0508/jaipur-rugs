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
}

interface EmployeeSignInResponse {
  employeeId: string;
}

/**
 * employee_code match against `employees` — NOT Supabase Auth. No password, no phone/email,
 * no auth.users row, no session. A code that doesn't match an active row is a hard failure
 * (no phone/email fallback, no recovery cascade — see db/MIGRATIONS.md's "Employee login
 * simplified to code-only" entry); throws a plain Error with the edge function's message
 * ("No active employee matches that employee code." for both an unknown code and an
 * inactive one — deliberately the same message either way).
 */
export async function employeeSignIn(supabase: SupabaseClient, input: EmployeeSignInInput) {
  const { data, error } = await supabase.functions.invoke<EmployeeSignInResponse>("employee-signin", {
    body: input,
  });

  if (error || !data) {
    throw new Error(await parseEmployeeSignInErrorMessage(error));
  }

  return data;
}

/** Reads a FunctionsHttpError's body for a display-ready message; response bodies can only be read once. */
async function parseEmployeeSignInErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (typeof body?.error === "string") {
        return body.error;
      }
    } catch {
      // fall through to the generic message below
    }
  }
  return error instanceof Error ? error.message : "The request failed.";
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

export interface BulkUploadEmployeeRow {
  fullName: string;
  email: string;
  /** Only meaningful (and only read server-side) when `dedupKey` is `"employee_code"`. */
  employeeCode?: string;
  departmentId?: string | null;
  managerId?: string | null;
  primaryRoleId?: string | null;
  employmentType?: "full_time" | "part_time" | "contract" | "intern" | "consultant";
}

export interface BulkUploadEmployeesInput {
  dedupKey: "email" | "employee_code";
  overwriteExisting: boolean;
  rows: BulkUploadEmployeeRow[];
}

export interface BulkUploadEmployeeResult {
  index: number;
  action: "created" | "updated" | "skipped" | "failed";
  employeeId?: string;
  employeeCode?: string;
  error?: string;
}

interface BulkUploadEmployeesResponse {
  results: BulkUploadEmployeeResult[];
}

/**
 * Invokes `bulk-upload-employees` — the Team page's "Bulk upload" flow. The caller has
 * already parsed the spreadsheet and resolved department/manager/role names to ids
 * client-side (against data it read from the DB); this only sends the resolved rows plus
 * the dedup key and overwrite choice the uploader picked. Requires `employees.write`, same
 * as `inviteEmployee`/`updateEmployee` — a bulk upload is treated as N of those actions,
 * not a separately-gated capability.
 */
export async function bulkUploadEmployees(supabase: SupabaseClient, input: BulkUploadEmployeesInput) {
  const { data, error } = await supabase.functions.invoke<BulkUploadEmployeesResponse>("bulk-upload-employees", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

// ---------------------------------------------------------------------------
// Hub module (apps/hub) — Settings > Departments/Roles/Apps management (the reference
// tables employee records hang off of). Same permission-gated, write-through-edge-function
// shape as the Team-page functions above; see db/team-members/001_team_members_schema.sql
// for the `*.manage` permissions these require.

export interface CreateDepartmentInput {
  name: string;
  code: string;
  parentDepartmentId?: string;
}

interface CreateDepartmentResponse {
  departmentId: string;
}

/** Invokes `create-department`. Requires `departments.manage`. */
export async function createDepartment(supabase: SupabaseClient, input: CreateDepartmentInput) {
  const { data, error } = await supabase.functions.invoke<CreateDepartmentResponse>("create-department", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface UpdateDepartmentInput {
  departmentId: string;
  name?: string;
  code?: string;
  parentDepartmentId?: string | null;
}

interface UpdateDepartmentResponse {
  departmentId: string;
}

/** Invokes `update-department`. Requires `departments.manage`. */
export async function updateDepartment(supabase: SupabaseClient, input: UpdateDepartmentInput) {
  const { data, error } = await supabase.functions.invoke<UpdateDepartmentResponse>("update-department", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface DeleteDepartmentInput {
  departmentId: string;
}

interface DeleteDepartmentResponse {
  departmentId: string;
}

/** Invokes `delete-department`. Requires `departments.manage`. Fails with a friendly 409 if the department is still referenced (employees, other departments, access grants). */
export async function deleteDepartment(supabase: SupabaseClient, input: DeleteDepartmentInput) {
  const { data, error } = await supabase.functions.invoke<DeleteDepartmentResponse>("delete-department", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  isGlobal?: boolean;
}

interface CreateRoleResponse {
  roleId: string;
}

/** Invokes `create-role`. Requires `roles.manage`. */
export async function createRole(supabase: SupabaseClient, input: CreateRoleInput) {
  const { data, error } = await supabase.functions.invoke<CreateRoleResponse>("create-role", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface UpdateRoleInput {
  roleId: string;
  name?: string;
  description?: string | null;
  isGlobal?: boolean;
}

interface UpdateRoleResponse {
  roleId: string;
}

/** Invokes `update-role`. Requires `roles.manage`. */
export async function updateRole(supabase: SupabaseClient, input: UpdateRoleInput) {
  const { data, error } = await supabase.functions.invoke<UpdateRoleResponse>("update-role", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface DeleteRoleInput {
  roleId: string;
}

interface DeleteRoleResponse {
  roleId: string;
}

/** Invokes `delete-role`. Requires `roles.manage`. Fails with a friendly 409 if the role is still referenced (employees, role_permissions, role_app_access). */
export async function deleteRole(supabase: SupabaseClient, input: DeleteRoleInput) {
  const { data, error } = await supabase.functions.invoke<DeleteRoleResponse>("delete-role", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface CreateAppInput {
  key: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

interface CreateAppResponse {
  appId: string;
}

/** Invokes `create-app`. Requires `apps.manage`. */
export async function createApp(supabase: SupabaseClient, input: CreateAppInput) {
  const { data, error } = await supabase.functions.invoke<CreateAppResponse>("create-app", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface UpdateAppInput {
  appId: string;
  key?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

interface UpdateAppResponse {
  appId: string;
}

/** Invokes `update-app`. Requires `apps.manage`. */
export async function updateApp(supabase: SupabaseClient, input: UpdateAppInput) {
  const { data, error } = await supabase.functions.invoke<UpdateAppResponse>("update-app", {
    body: input,
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface DeleteAppInput {
  appId: string;
}

interface DeleteAppResponse {
  appId: string;
}

/** Invokes `delete-app`. Requires `apps.manage`. Fails with a friendly 409 if the app is still referenced (permissions, role_app_access). */
export async function deleteApp(supabase: SupabaseClient, input: DeleteAppInput) {
  const { data, error } = await supabase.functions.invoke<DeleteAppResponse>("delete-app", {
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

interface AddOwnCustomerCodesResponse {
  employeeId: string;
  added: string[];
}

/**
 * Invokes `customer-codes-add` — the customer-code counterpart to
 * addOwnSalespersonCodes, added 2026-09-10 alongside registering "Back Ops" as a real
 * department. Same posture: self-service, always the CALLER'S OWN account, no approval
 * step, effective immediately. Use this (not addOwnSalespersonCodes) when the value the
 * person typed is an ERP customer number (e.g. "24523", "34836") rather than a
 * salesperson code (e.g. "SALES-0039") — see db/orders/017_backops_department_self_service.sql
 * for why the two were previously easy to conflate (pasting a customer code into the
 * salesperson-code form silently added it as a salesperson code, which then matched
 * nothing).
 */
export async function addOwnCustomerCodes(supabase: SupabaseClient, codes: string[]) {
  const { data, error } = await supabase.functions.invoke<AddOwnCustomerCodesResponse>(
    "customer-codes-add",
    { body: { codes } },
  );
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

interface RemoveOwnSalespersonCodeResponse {
  employeeId: string;
  removed: string;
}

/**
 * Invokes `salesperson-codes-remove` — the undo counterpart to addOwnSalespersonCodes.
 * Self-service, always the CALLER'S OWN account. Added 2026-09-15 alongside
 * customer-codes-remove: until then, a code added by mistake (e.g. someone else's,
 * pasted in as a workaround) could never be taken back off an account.
 */
export async function removeOwnSalespersonCode(supabase: SupabaseClient, code: string) {
  const { data, error } = await supabase.functions.invoke<RemoveOwnSalespersonCodeResponse>(
    "salesperson-codes-remove",
    { body: { code } },
  );
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

interface RemoveOwnCustomerCodeResponse {
  employeeId: string;
  removed: string;
}

/**
 * Invokes `customer-codes-remove` — the undo counterpart to addOwnCustomerCodes. Same
 * posture: self-service, always the CALLER'S OWN account, effective immediately.
 */
export async function removeOwnCustomerCode(supabase: SupabaseClient, code: string) {
  const { data, error } = await supabase.functions.invoke<RemoveOwnCustomerCodeResponse>(
    "customer-codes-remove",
    { body: { code } },
  );
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export type SelfServiceDepartmentCode = "management" | "production" | "backops" | "jli";

interface JoinDepartmentResponse {
  employeeId: string;
  departmentCode: string;
}

/**
 * Invokes `join-department` — self-service, always the CALLER'S OWN account, always at
 * the lowest access level ('view'). "management", "production", (added 2026-09-10)
 * "backops", and (added 2026-09-19) "jli" are accepted — NOT "sales" (that department
 * code means blanket view-all; an individual salesperson must stay scoped to their own
 * codes via addOwnSalespersonCodes instead) — matching the explicit product decision,
 * 2026-09-05: "Management, Production should [see] all orders... and not [be] bind[ing]
 * with any customer code." Unlike management/production, joining "backops" grants NO
 * order visibility by itself — it only marks org placement; a Back Ops employee still
 * needs their own sales and/or customer code(s) via addOwnSalespersonCodes /
 * addOwnCustomerCodes. "jli" (Jaipur Living) is a third shape, different from both:
 * joining it DOES grant order visibility, but only for the codes pre-set on the
 * department itself (db/orders/034_jli_department_customer_codes.sql), not blanket and
 * not requiring the employee to know/enter any code of their own. NAV/QC/Shipping still
 * aren't self-service ("will come in later stage," same decision).
 */
export async function joinOwnDepartment(supabase: SupabaseClient, departmentCode: SelfServiceDepartmentCode) {
  const { data, error } = await supabase.functions.invoke<JoinDepartmentResponse>("join-department", {
    body: { departmentCode },
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

interface RequestOrdersColumnResponse {
  id: string;
  /** True if this exact person already had a pending request for this exact field —
   * the function dedupes rather than creating a second row every time the "Request a
   * column" list is reopened. */
  alreadyRequested: boolean;
}

/**
 * Invokes `orders-request-column` — self-service, always the CALLER'S OWN account. Logs
 * a request for one specific NAV field (from the full catalog in
 * apps/atlas/lib/requestableNavFields.ts) that isn't in Atlas's `orders` table yet, for
 * Ayaan to review and, if approved, actually add. Direct decision, 2026-09-12: rather
 * than add all ~180 candidate NAV fields up front (more load on orders-sync.mjs's every-
 * 30-minute pull for fields most people never look at), only fields someone actually
 * asks for get added, one at a time — see db/orders/022_column_requests.sql.
 */
export async function requestOrdersColumn(supabase: SupabaseClient, navFieldName: string, notes?: string) {
  const { data, error } = await supabase.functions.invoke<RequestOrdersColumnResponse>("orders-request-column", {
    body: { navFieldName, notes },
  });
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface ResolveColumnRequestInput {
  requestId: string;
  decision: "approved" | "declined";
  notes?: string;
}

interface ResolveColumnRequestResponse {
  requestId: string;
  status: "approved" | "declined";
}

/**
 * Invokes `orders-resolve-column-request` — admin-only (orders.read.all). Records the
 * decision immediately; 'approved' is NOT the same as the field actually existing yet —
 * see that function's own comment for why making it real still needs a real migration +
 * orders-sync.mjs update, not something this call does on its own.
 */
export async function resolveColumnRequest(supabase: SupabaseClient, input: ResolveColumnRequestInput) {
  const { data, error } = await supabase.functions.invoke<ResolveColumnRequestResponse>(
    "orders-resolve-column-request",
    { body: input },
  );
  if (error || !data) {
    throw new Error(await extractErrorMessage(error));
  }
  return data;
}

export interface OrdersViewPreferencesInput {
  hiddenColumns?: string[];
  columnOrder?: string[];
  hiddenFilters?: string[];
  /** Added 2026-09-19 (db/orders/038_filter_order.sql) — same idiom as columnOrder, for
   * the filter bar's own drag-and-drop reordering. */
  filterOrder?: string[];
  rowHeight?: "compact" | "normal" | "comfortable";
}

/**
 * Invokes `orders-save-view-preferences` — self-service, always the CALLER'S OWN
 * account, takes effect immediately (no approval step, this is UI preference not order
 * data). Only the fields present in `input` are changed; omitted ones keep whatever's
 * already stored. Direct request, 2026-09-14: "lock the user's view acc to their user
 * id... from any system" — replaces the localStorage-only version
 * (useLocalPreference) with one that actually follows the account across devices — see
 * db/orders/023_user_view_preferences_and_request_approval.sql.
 */
export async function saveOrdersViewPreferences(supabase: SupabaseClient, input: OrdersViewPreferencesInput) {
  const { data, error } = await supabase.functions.invoke<{ employeeId: string }>(
    "orders-save-view-preferences",
    { body: input },
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
