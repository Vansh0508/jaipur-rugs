import type { SupabaseClient } from "@supabase/supabase-js";

export interface EmployeeCandidate {
  id: string;
  fullName: string;
  employeeCode: string;
  phone: string | null;
  departmentName: string | null;
}

/**
 * Backs the journey guest pool's "Employee" mode — active employees by name or employee
 * code. Readable to Internal Portal admins via employees_select (db/journeys/011).
 */
export async function searchEmployeeCandidates(supabase: SupabaseClient, query: string): Promise<EmployeeCandidate[]> {
  // Strip PostgREST filter syntax characters so a typed comma/paren can't break the or().
  const trimmed = query.trim().replace(/[,()]/g, " ");
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_code, phone, department:departments!employees_department_id_fkey(name)")
    .eq("status", "active")
    .or(`full_name.ilike.%${trimmed}%,employee_code.ilike.%${trimmed}%`)
    .order("full_name")
    .limit(10);
  if (error) throw error;
  return ((data ?? []) as unknown as {
    id: string;
    full_name: string;
    employee_code: string;
    phone: string | null;
    department: { name: string } | null;
  }[]).map((e) => ({
    id: e.id,
    fullName: e.full_name,
    employeeCode: e.employee_code,
    phone: e.phone,
    departmentName: e.department?.name ?? null,
  }));
}

export interface EmployeeByCode {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentName: string | null;
  /** Only an `active` employee can be booked for — the form explains why otherwise. */
  isActive: boolean;
}

/**
 * The conference booking form's "Employee ID" lookup: one employee by exact employee code
 * (case-insensitive), or null when there's no such code. Readable to Internal Portal admins
 * via employees_select (db/journeys/011).
 */
export async function findEmployeeByCode(supabase: SupabaseClient, code: string): Promise<EmployeeByCode | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  // ilike without wildcards = case-insensitive equality; escape the ones a code could contain.
  const exact = trimmed.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_code, status, department:departments!employees_department_id_fkey(name)")
    .ilike("employee_code", exact)
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0] as unknown as
    | { id: string; full_name: string; employee_code: string; status: string; department: { name: string } | null }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    employeeCode: row.employee_code,
    departmentName: row.department?.name ?? null,
    isActive: row.status === "active",
  };
}
