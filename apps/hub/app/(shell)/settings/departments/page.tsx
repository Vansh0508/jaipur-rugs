import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { employeeHasPermission } from "@/lib/auth/requireHubAccess";
import { listDepartmentsFull } from "@/lib/queries/departments";
import { DepartmentsTable } from "@/components/settings/departments/DepartmentsTable";

export default async function SettingsDepartmentsPage() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: self } = await supabase
    .from("employees")
    .select("id, primary_role_id")
    .eq("auth_user_id", user!.id)
    .maybeSingle();
  const canManage = self ? await employeeHasPermission(supabase, self.id, self.primary_role_id, "departments.manage") : false;
  if (!canManage) {
    redirect("/settings");
  }

  const departments = await listDepartmentsFull(supabase);

  return <DepartmentsTable rows={departments} />;
}
