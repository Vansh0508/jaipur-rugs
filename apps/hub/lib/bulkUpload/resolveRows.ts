import type { BulkUploadEmployeeRow } from "@jaipur-rugs/db-management-client";
import type { TeamDirectoryRow } from "@/lib/queries/employees";
import type { ParsedEmployeeRow } from "./parseEmployeeFile";

export type DedupKey = "email" | "employee_code";

type EmploymentType = "full_time" | "part_time" | "contract" | "intern" | "consultant";

const EMPLOYMENT_TYPE_VALUES: EmploymentType[] = ["full_time", "part_time", "contract", "intern", "consultant"];

export type RowAction =
  | { kind: "create" }
  | { kind: "update"; employeeId: string }
  | { kind: "skip"; employeeId: string }
  | { kind: "error"; reason: string };

/** One row of the Step 2 preview report — everything the table needs to render, already
 * resolved against the reference data loaded on the Team page. `action` is what
 * BulkUploadEmployeesModal actually does with the row: an "error" row is never sent to the
 * server at all, and a "skip" row is sent nowhere either (there's nothing to write). */
export interface ResolvedRow {
  /** 1-based position among non-blank data rows — shown in the report as "Row N", not a
   * literal spreadsheet line number (which would need to account for the header row and
   * any blank rows skipped before this one). */
  rowNumber: number;
  fullName: string;
  email: string;
  departmentName: string | null;
  managerLabel: string | null;
  roleLabel: string | null;
  employmentType: EmploymentType | null;
  action: RowAction;
  /** Only set on "create"/"update" rows — what actually gets sent to bulk-upload-employees. */
  payload?: BulkUploadEmployeeRow;
}

export interface ResolveRowsInput {
  parsedRows: ParsedEmployeeRow[];
  departments: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  directory: TeamDirectoryRow[];
  dedupKey: DedupKey;
  overwriteExisting: boolean;
}

function findByExactNameCI<T extends { name: string }>(items: T[], name: string): T[] {
  const target = name.trim().toLowerCase();
  return items.filter((item) => item.name.trim().toLowerCase() === target);
}

/**
 * Classifies every parsed spreadsheet row for the Step 2 preview and builds the exact
 * payload that would be sent to `bulk-upload-employees` if the uploader confirms — this is
 * the single place that logic lives, so the report shown to the uploader and the request
 * actually sent can never drift apart from each other.
 *
 * No field is unconditionally required — the mapping step (fieldMapping.ts) never forces
 * the uploader to map every column, and this function doesn't invent a mandatory-field
 * rule on top of that. The one thing that *does* become required is a full name + email,
 * and only once it's clear a row doesn't match an existing employee — the `employees`
 * table itself has no way to create a row without those two columns, so that's a real
 * constraint being surfaced early (as a per-row error, not a blanket upload-time block),
 * not a tool-imposed one. A row that resolves to an update against an existing employee
 * (e.g. found purely by employee_code) needs neither.
 *
 * Any row whose department/role/manager reference doesn't resolve cleanly becomes an
 * "error" row rather than silently dropping that reference — a typo'd department name
 * should never quietly file someone under no department at all.
 */
export function resolveRows({
  parsedRows,
  departments,
  roles,
  directory,
  dedupKey,
  overwriteExisting,
}: ResolveRowsInput): ResolvedRow[] {
  const results: ResolvedRow[] = [];
  // Tracks the identity key (see below) of every row already processed in *this file*, so
  // two rows in the same upload that both resolve to the same identity are caught here —
  // resolving each row only against `directory` (the state existing in the DB before this
  // upload started) would miss that, and the preview would show two "New" rows for what
  // would actually create one and update/skip the other once the server processes them in
  // order. Reported as an error rather than silently guessed at.
  const seenKeys = new Set<string>();
  let rowNumber = 0;

  for (const raw of parsedRows) {
    // A fully blank row is a typical trailing-row spreadsheet artifact, not something
    // worth surfacing as an error.
    if (!raw.fullName && !raw.email && !raw.department && !raw.managerEmail && !raw.role && !raw.employmentType && !raw.employeeCode) {
      continue;
    }

    rowNumber += 1;
    const fullName = raw.fullName;
    const email = raw.email.trim().toLowerCase();
    const employeeCode = raw.employeeCode.trim();

    const errors: string[] = [];

    let departmentId: string | null = null;
    let departmentName: string | null = null;
    if (raw.department) {
      const matches = findByExactNameCI(departments, raw.department);
      const match = matches.length === 1 ? matches[0] : undefined;
      if (match) {
        departmentId = match.id;
        departmentName = match.name;
      } else {
        errors.push(`Department "${raw.department}" was not found`);
      }
    }

    let primaryRoleId: string | null = null;
    let roleLabel: string | null = null;
    if (raw.role) {
      const matches = findByExactNameCI(roles, raw.role);
      const match = matches.length === 1 ? matches[0] : undefined;
      if (match) {
        primaryRoleId = match.id;
        roleLabel = match.name;
      } else if (matches.length === 0) {
        errors.push(`Role "${raw.role}" was not found`);
      } else {
        errors.push(`Role "${raw.role}" matches more than one role — role names aren't guaranteed unique, so this needs to be set by hand`);
      }
    }

    let managerId: string | null = null;
    let managerLabel: string | null = null;
    if (raw.managerEmail) {
      const target = raw.managerEmail.trim().toLowerCase();
      const match = directory.find((employee) => employee.email.toLowerCase() === target);
      if (match) {
        managerId = match.id;
        managerLabel = match.fullName;
      } else {
        errors.push(`Manager "${raw.managerEmail}" doesn't match any existing employee's email (a manager who's also new in this same file isn't supported yet — upload them first, then re-upload their reports)`);
      }
    }

    let employmentType: EmploymentType | null = null;
    if (raw.employmentType) {
      const normalized = raw.employmentType.trim().toLowerCase().replace(/[\s-]+/g, "_") as EmploymentType;
      if (EMPLOYMENT_TYPE_VALUES.includes(normalized)) {
        employmentType = normalized;
      } else {
        errors.push(`Employment type "${raw.employmentType}" isn't one of full_time/part_time/contract/intern/consultant`);
      }
    }

    // The identity this row is looked up (and, if new, matched against future uploads) by
    // — whichever the chosen dedup key actually has a value for. A row with neither has no
    // identity at all yet; it's only an error if that also means it can't be created (below).
    const identityValue =
      dedupKey === "employee_code" && employeeCode ? `code:${employeeCode.toLowerCase()}` : email ? `email:${email}` : null;

    if (identityValue) {
      if (seenKeys.has(identityValue)) {
        errors.push(`Duplicate within this file — another row already uses the same ${identityValue.startsWith("code:") ? "employee code" : "email"}`);
      } else {
        seenKeys.add(identityValue);
      }
    }

    const existing =
      dedupKey === "employee_code" && employeeCode
        ? directory.find((employee) => employee.employeeCode.toLowerCase() === employeeCode.toLowerCase())
        : email
          ? directory.find((employee) => employee.email.toLowerCase() === email)
          : undefined;

    if (!existing && (!fullName || !email)) {
      errors.push("This row doesn't match an existing employee, so it would create a new one — that needs at least a full name and an email");
    }

    if (errors.length > 0) {
      results.push({
        rowNumber,
        fullName,
        email,
        departmentName: raw.department || null,
        managerLabel: raw.managerEmail || null,
        roleLabel: raw.role || null,
        employmentType: null,
        action: { kind: "error", reason: errors.join("; ") },
      });
      continue;
    }

    const payload: BulkUploadEmployeeRow = {
      fullName,
      email,
      employeeCode: raw.employeeCode || undefined,
      departmentId,
      managerId,
      primaryRoleId,
      employmentType: employmentType ?? undefined,
    };

    const action: RowAction = !existing
      ? { kind: "create" }
      : overwriteExisting
        ? { kind: "update", employeeId: existing.id }
        : { kind: "skip", employeeId: existing.id };

    results.push({
      rowNumber,
      fullName,
      email,
      departmentName,
      managerLabel,
      roleLabel,
      employmentType,
      action,
      payload: action.kind === "create" || action.kind === "update" ? payload : undefined,
    });
  }

  return results;
}

/** The exact set of rows Step 2's "Confirm upload" sends — errors and skips are excluded,
 * since there's nothing for the server to do with either. */
export function toBulkUploadPayloadRows(resolved: ResolvedRow[]): BulkUploadEmployeeRow[] {
  return resolved.flatMap((row) => (row.payload ? [row.payload] : []));
}
