import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { employeeHasPermission } from "@/lib/auth/requireHubAccess";
import { listApps } from "@/lib/queries/apps";
import { AppsTable } from "@/components/settings/apps/AppsTable";

export default async function SettingsAppsPage() {
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
  const canManage = self ? await employeeHasPermission(supabase, self.id, self.primary_role_id, "apps.manage") : false;
  if (!canManage) {
    redirect("/settings");
  }

  const apps = await listApps(supabase);

  return <AppsTable rows={apps} />;
}
