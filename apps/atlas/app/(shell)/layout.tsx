import type { ReactNode } from "react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireAtlasStaffAccess } from "@/lib/auth/requireAtlasStaffAccess";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { UserMenu } from "@/components/shell/UserMenu";

// The defensive re-check (AGENTS.md Section 5), same as every other app's shell layout.
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerSupabaseClient();
  const access = await requireAtlasStaffAccess(supabase);

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-col">
        <SidebarNav isAdmin={access.isAdmin} />
        <UserMenu fullName={access.fullName} />
      </div>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
