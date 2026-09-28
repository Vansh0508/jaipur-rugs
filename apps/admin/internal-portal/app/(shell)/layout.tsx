import type { ReactNode } from "react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireInternalPortalAccess } from "@/lib/auth/requireInternalPortalAccess";
import { SidebarShell } from "@/components/shell/SidebarShell";

// The defensive re-check (AGENTS.md Section 5: "every app independently re-verifies...
// on load", not just at the edge) — deliberately duplicates proxy.ts's own check rather
// than trusting the matcher alone.
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerSupabaseClient();
  const employee = await requireInternalPortalAccess(supabase);

  return (
    // Standard department app shell (apps/hub, apps/atlas). `fixed inset-0`, not
    // `min-h-screen`: pins the shell to the viewport so the sidebar and the content card
    // each scroll independently, instead of the whole page scrolling and dragging the
    // sidebar with it. `bg-app` (grey) fills the whole viewport so the sidebar strip and
    // the gap around the content card read as one continuous field.
    <div className="fixed inset-0 flex overflow-hidden bg-app">
      <SidebarShell fullName={employee.fullName} email={employee.email} />
      {/* Detached white content card, shadow weighted toward the sidebar-facing (left)
          edge. Only this card's contents scroll. */}
      <main className="my-2.5 mr-2.5 ml-1.5 flex h-[calc(100vh-20px)] min-w-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-border/80 bg-surface p-6 shadow-[-6px_0_20px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.03)] lg:p-7">
        {children}
      </main>
    </div>
  );
}
