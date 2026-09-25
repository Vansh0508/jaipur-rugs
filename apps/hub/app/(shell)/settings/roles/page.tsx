import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { employeeHasPermission } from "@/lib/auth/requireHubAccess";
import { listRolesFull } from "@/lib/queries/roles";
import { RolesTable } from "@/components/settings/roles/RolesTable";

export default async function SettingsRolesPage() {
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
  const canManage = self ? await employeeHasPermission(supabase, self.id, self.primary_role_id, "roles.manage") : false;
  if (!canManage) {
    redirect("/settings");
  }

  const roles = await listRolesFull(supabase);

  return <RolesTable rows={roles} />;
}
