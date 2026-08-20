import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";

export type Employee = Tables<"employees">;

export interface TeamDirectoryRow {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  status: Employee["status"];
  avatarPath: string | null;
  employmentType: Employee["employment_type"];
  departmentId: string | null;
  departmentName: string | null;
  managerId: string | null;
  managerName: string | null;
  primaryRoleId: string | null;
  roleName: string | null;
}

/**
 * Whatever `employees_select`'s RLS policy scopes a given caller to (self, manager-chain,
 * same department, or `employees.read.all`) — see db/team-members/001_team_members_schema.sql.
 * Non-admins legitimately see a smaller list than an Admin does; that's the RLS working as
 * designed, not a bug in this query. Includes the raw department/manager/role ids (not
 * just their display names) so the Team page's edit modal can prefill its Selects.
 */
export async function listTeamDirectory(supabase: SupabaseClient): Promise<TeamDirectoryRow[]> {
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, full_name, email, employee_code, status, avatar_path, employment_type, department_id, manager_id, primary_role_id, departments(name), manager:employees!manager_id(full_name), roles(name)",
    )
    .order("full_name");
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    employeeCode: row.employee_code,
    status: row.status,
    avatarPath: row.avatar_path,
    employmentType: row.employment_type,
    departmentId: row.department_id,
    departmentName: row.departments?.name ?? null,
    managerId: row.manager_id,
    managerName: row.manager?.full_name ?? null,
    primaryRoleId: row.primary_role_id,
    roleName: row.roles?.name ?? null,
  }));
}

export interface OwnProfile {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  phone: string | null;
  departmentId: string | null;
  departmentName: string | null;
  managerName: string | null;
  roleName: string | null;
  employmentType: Employee["employment_type"];
  joinedAt: string | null;
  avatarPath: string | null;
}

/** For the manager picker in the Team page's add/edit modals — plain id/name, no directory scoping details needed. */
export async function listManagerCandidates(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("employees").select("id, full_name").order("full_name");
  if (error) throw error;
  return (data ?? []) as { id: string; full_name: string }[];
}

export async function getOwnProfile(supabase: SupabaseClient, authUserId: string): Promise<OwnProfile | null> {
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, full_name, email, employee_code, phone, department_id, employment_type, joined_at, avatar_path, departments(name), manager:employees!manager_id(full_name), roles(name)",
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as any;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    employeeCode: row.employee_code,
    phone: row.phone,
    departmentId: row.department_id,
    departmentName: row.departments?.name ?? null,
    managerName: row.manager?.full_name ?? null,
    roleName: row.roles?.name ?? null,
    employmentType: row.employment_type,
    joinedAt: row.joined_at,
    avatarPath: row.avatar_path,
  };
}
