import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { employeeHasPermission } from "@/lib/auth/requireHubAccess";
import { PageHeader } from "@/components/shared/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";

// Nothing here is a real access boundary — the shell layout already established the
// caller is an active, onboarded employee, and every write under /settings re-checks its
// own `*.manage` permission server-side via requireEmployeePermission regardless of what
// this layout renders. Same "recompute per screen" pattern as app/(shell)/team/page.tsx.
export default async function SettingsLayout({ children }: { children: ReactNode }) {
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

  const [canManageDepartments, canManageRoles, canManageApps] = self
    ? await Promise.all([
        employeeHasPermission(supabase, self.id, self.primary_role_id, "departments.manage"),
        employeeHasPermission(supabase, self.id, self.primary_role_id, "roles.manage"),
        employeeHasPermission(supabase, self.id, self.primary_role_id, "apps.manage"),
      ])
    : [false, false, false];

  if (!canManageDepartments && !canManageRoles && !canManageApps) {
    redirect("/profile");
  }

  return (
    <div>
      <PageHeader
        title="Manage Dependencies"
        description="Departments, roles, and the app registry that employee records reference."
      />
      <SettingsNav
        canManageDepartments={canManageDepartments}
        canManageRoles={canManageRoles}
        canManageApps={canManageApps}
      />
      <div className="mt-6">{children}</div>
    </div>
  );
}
