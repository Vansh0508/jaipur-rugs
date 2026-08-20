import type { ReactNode } from "react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireHubAccess } from "@/lib/auth/requireHubAccess";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { UserMenu } from "@/components/shell/UserMenu";

// The defensive re-check (AGENTS.md Section 5: "every app independently re-verifies...
// on load", not just at the edge) — deliberately duplicates proxy.ts's own check rather
// than trusting the matcher alone.
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerSupabaseClient();
  const employee = await requireHubAccess(supabase);

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-col">
        <SidebarNav canManageTeam={employee.canManageTeam} />
        <UserMenu fullName={employee.fullName} />
      </div>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
