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
