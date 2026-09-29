import { redirect } from "next/navigation";
export async function requireSketchChallanAccess(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: employee } = await supabase.from("employees").select("id, full_name, status, primary_role_id").eq("auth_user_id", user.id).maybeSingle();
  if (!employee || employee.status !== "active") redirect("/login?error=not_authorized");
  const roleIds = employee.primary_role_id ? [employee.primary_role_id] : [];
  const today = new Date().toISOString().slice(0, 10);
  const { data: assigned } = await supabase.from("employee_roles").select("role_id, valid_to").eq("employee_id", employee.id).lte("valid_from", today);
  const currentAssignments = (assigned ?? []) as { role_id: string; valid_to: string | null }[];
  roleIds.push(...currentAssignments.filter((row) => !row.valid_to || row.valid_to >= today).map((row) => row.role_id));
  const { data: bindings } = roleIds.length
    ? await supabase.from("sketch_challan_role_bindings").select("role_key,role_id").in("role_id", roleIds)
    : { data: [] };
  const roleKeys = ((bindings ?? []) as { role_key: string }[]).map((binding) => binding.role_key);
  if (roleKeys.length === 0) redirect("/api/force-logout?reason=not_authorized");
  return { employeeId: employee.id, fullName: employee.full_name, roleKeys };
}
