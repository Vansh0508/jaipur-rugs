import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { employeeHasPermission } from "@/lib/auth/requireHubAccess";

// /settings itself renders nothing — it just sends the caller to the first tab they can
// manage (the layout has already redirected away anyone with none of the three).
export default async function SettingsIndexPage() {
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
  if (!self) {
    redirect("/profile");
  }

  if (await employeeHasPermission(supabase, self.id, self.primary_role_id, "departments.manage")) {
    redirect("/settings/departments");
  }
  if (await employeeHasPermission(supabase, self.id, self.primary_role_id, "roles.manage")) {
    redirect("/settings/roles");
  }
  if (await employeeHasPermission(supabase, self.id, self.primary_role_id, "apps.manage")) {
    redirect("/settings/apps");
  }
  redirect("/profile");
}
