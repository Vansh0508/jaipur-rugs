import type { ReactNode } from "react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireHubAccess } from "@/lib/auth/requireHubAccess";
import { SidebarShell } from "@/components/shell/SidebarShell";

// The defensive re-check (AGENTS.md Section 5: "every app independently re-verifies...
// on load", not just at the edge) — deliberately duplicates proxy.ts's own check rather
// than trusting the matcher alone.
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerSupabaseClient();
  const employee = await requireHubAccess(supabase);

  return (
    // `fixed inset-0`, not `min-h-screen` — matches apps/atlas/app/(shell)/layout.tsx and
    // apps/DND/BOM Checker's app-shell.tsx: pins this wrapper directly to the viewport so
    // only the two panels below scroll, each independently, instead of the whole page.
    //
    // `bg-app` (grey) fills the whole viewport — both the sidebar strip and the small gap
    // around the content card below read as one continuous grey field.
    <div className="fixed inset-0 flex overflow-hidden bg-app">
      <SidebarShell
        canManageTeam={employee.canManageTeam}
        canManageDependencies={employee.canManageDependencies}
        fullName={employee.fullName}
      />
      {/* The content area is its own detached white card, floating against the grey
          shell with rounded corners and a shadow weighted toward its left edge (where it
          meets the sidebar), same as BOM Checker's app-shell.tsx. */}
      <main className="my-2.5 mr-2.5 ml-1.5 flex h-[calc(100vh-20px)] min-w-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-border/80 bg-surface p-6 shadow-[-6px_0_20px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.03)] lg:p-7">
        {children}
      </main>
    </div>
  );
}
