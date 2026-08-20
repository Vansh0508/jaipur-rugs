import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { employeeHasPermission } from "@/lib/auth/requireHubAccess";
import { listTeamDirectory, listManagerCandidates } from "@/lib/queries/employees";
import { listDepartments } from "@/lib/queries/departments";
import { listRoles } from "@/lib/queries/roles";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AddTeamMemberAction } from "@/components/team/AddTeamMemberAction";
import { TeamTable } from "@/components/team/TeamTable";

// Nothing here is a real access boundary — the shell layout already established the
// caller is an active, onboarded employee, and every write below re-checks
// `employees.write` server-side via requireEmployeePermission regardless of what this
// page renders. This is purely "which admin controls should the page show."
export default async function TeamPage() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: self } = await supabase.from("employees").select("id, primary_role_id").eq("auth_user_id", user!.id).maybeSingle();
  const canManageTeam = self ? await employeeHasPermission(supabase, self.id, self.primary_role_id, "employees.write") : false;

  const [directory, departments, roles, managerCandidates] = await Promise.all([
    listTeamDirectory(supabase),
    canManageTeam ? listDepartments(supabase) : Promise.resolve([]),
    canManageTeam ? listRoles(supabase) : Promise.resolve([]),
    canManageTeam ? listManagerCandidates(supabase) : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Team"
        description={canManageTeam ? "Manage departments, managers, and roles." : "People in your org, department, and reporting chain."}
        action={canManageTeam ? <AddTeamMemberAction departments={departments} roles={roles} managerCandidates={managerCandidates} /> : null}
      />
      {directory.length === 0 ? (
        <EmptyState message="No teammates visible yet." />
      ) : (
        <TeamTable
          rows={directory}
          canManageTeam={canManageTeam}
          departments={departments}
          roles={roles}
          managerCandidates={managerCandidates}
        />
      )}
    </div>
  );
}
