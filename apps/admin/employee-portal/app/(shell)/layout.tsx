import type { ReactNode } from "react";
import { SidebarShell } from "@/components/shell/SidebarShell";

// Standard department app shell (apps/hub, apps/atlas, apps/admin/internal-portal) — with no
// access check and no user menu, because this app has no login by design: anyone who can
// open it can send a request, and every request waits for an Internal Portal admin.
//
// `fixed inset-0`, not `min-h-screen`: pins the shell to the viewport so the sidebar and the
// content card each scroll independently. `bg-app` (grey) fills the whole viewport so the
// sidebar strip and the gap around the content card read as one continuous field.
export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex overflow-hidden bg-app">
      <SidebarShell />
      {/* Detached white content card, shadow weighted toward the sidebar-facing (left) edge. */}
      <main className="my-2.5 mr-2.5 ml-1.5 flex h-[calc(100vh-20px)] min-w-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-border/80 bg-surface p-6 shadow-[-6px_0_20px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.03)] lg:p-7">
        {children}
      </main>
    </div>
  );
}
