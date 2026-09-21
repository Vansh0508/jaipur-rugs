import type { ReactNode } from "react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireCadLayoutAccess } from "@/lib/auth/requireCadLayoutAccess";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { UserMenu } from "@/components/shell/UserMenu";

// Defensive re-check (AGENTS.md Section 5) — deliberately duplicates proxy.ts's gate.
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerSupabaseClient();
  const employee = await requireCadLayoutAccess(supabase);

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-col">
        <SidebarNav isAdmin={employee.isAdmin} />
        <UserMenu fullName={employee.fullName} />
      </div>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
