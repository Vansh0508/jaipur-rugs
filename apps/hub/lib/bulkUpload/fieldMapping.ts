import type { ParsedEmployeeRow } from "./parseEmployeeFile";

export const TARGET_FIELDS = [
  { key: "fullName", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "department", label: "Department" },
  { key: "managerEmail", label: "Manager email" },
  { key: "role", label: "Role" },
  { key: "employmentType", label: "Employment type" },
  { key: "employeeCode", label: "Employee code" },
] as const satisfies { key: keyof ParsedEmployeeRow; label: string }[];

export type TargetFieldKey = (typeof TARGET_FIELDS)[number]["key"];

/** Which of the uploader's own file columns feeds each of our fields — `null` means that
 * field is left unmapped. Every field is optional to map: the mapping step never blocks on
 * an unmapped field, since which fields actually matter depends on what a given row is
 * doing (see resolveRows.ts's header comment). */
export type FieldMapping = Record<TargetFieldKey, string | null>;

export function emptyMapping(): FieldMapping {
  return { fullName: null, email: null, department: null, managerEmail: null, role: null, employmentType: null, employeeCode: null };
}

/** Header text is matched case/whitespace/separator-insensitively (`Full Name`, `full_name`,
 * and `fullname` all match) purely to *pre-fill* the mapping step with a best guess — the
 * uploader sees exactly what got auto-matched and can freely change or clear any of it
 * before continuing, so a wrong guess here is a convenience miss, never a correctness bug. */
const HEADER_ALIASES: Record<string, TargetFieldKey> = {
  fullname: "fullName",
  name: "fullName",
  email: "email",
  emailaddress: "email",
  department: "department",
  dept: "department",
  manageremail: "managerEmail",
  managersemail: "managerEmail",
  manager: "managerEmail",
  role: "role",
  employmenttype: "employmentType",
  employeecode: "employeeCode",
  code: "employeeCode",
};

function normalize(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Best-guess starting point for the mapping step, built from the file's own headers —
 * the uploader still explicitly confirms (or corrects) it before anything is parsed into
 * rows. */
export function suggestMapping(headers: string[]): FieldMapping {
  const mapping = emptyMapping();
  for (const header of headers) {
    const field = HEADER_ALIASES[normalize(header)];
    if (field && mapping[field] === null) {
      mapping[field] = header;
    }
  }
  return mapping;
}

/** Applies a confirmed mapping to the sheet's raw rows, producing the field-agnostic shape
 * resolveRows.ts works with. A field mapped to `null` (or to a header that turns out to be
 * missing from a given row) just comes through as "". */
export function applyMapping(rows: Record<string, string>[], mapping: FieldMapping): ParsedEmployeeRow[] {
  return rows.map((row) => ({
    fullName: mapping.fullName ? (row[mapping.fullName] ?? "") : "",
    email: mapping.email ? (row[mapping.email] ?? "") : "",
    department: mapping.department ? (row[mapping.department] ?? "") : "",
    managerEmail: mapping.managerEmail ? (row[mapping.managerEmail] ?? "") : "",
    role: mapping.role ? (row[mapping.role] ?? "") : "",
    employmentType: mapping.employmentType ? (row[mapping.employmentType] ?? "") : "",
    employeeCode: mapping.employeeCode ? (row[mapping.employeeCode] ?? "") : "",
  }));
}

/** First non-blank sample value for a given source column, shown next to its mapping
 * dropdown so the uploader can actually confirm they picked the right column instead of
 * guessing from the header name alone. */
export function sampleValueFor(rows: Record<string, string>[], header: string | null): string | null {
  if (!header) return null;
  for (const row of rows) {
    const value = row[header];
    if (value) return value;
  }
  return null;
}
