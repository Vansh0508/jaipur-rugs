import type { ReactNode } from "react";
import { headers } from "next/headers";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireAtlasStaffAccess } from "@/lib/auth/requireAtlasStaffAccess";
import { SidebarShell } from "@/components/shell/SidebarShell";

// The defensive re-check (AGENTS.md Section 5), same as every other app's shell layout.
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerSupabaseClient();
  // x-pathname is set by proxy.ts — /my-access is exempt from the "must already have
  // access" redirect, since it's the one page that lets someone with no access yet
  // grant themselves one.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const access = await requireAtlasStaffAccess(supabase, { allowUnauthorized: pathname.startsWith("/my-access") });

  return (
    // `fixed inset-0`, not `h-screen` — h-screen (100vh) still leaves the actual
    // <body> free to grow past one viewport (its default browser margin alone is
    // enough) and scroll as a whole page, which drags this entire block along with it
    // — confirmed live 2026-09-05, that's exactly why the sidebar wasn't staying put.
    // Pinning this wrapper directly to the viewport's edges makes it immune to
    // whatever <body>'s own height/scroll does; only the two panels below scroll,
    // each independently.
    //
    // `bg-app` (grey, see globals.css) fills the whole viewport — both the sidebar
    // strip and the small gap around the content card below read as one continuous
    // grey field, per the redesign, 2026-09-10.
    <div className="fixed inset-0 flex overflow-hidden bg-app">
      {/* SidebarShell owns the expand/collapse state (a real click toggle now, not
          CSS `:hover` — see that component's comment) and renders UserMenu pinned to
          its bottom, SidebarNav filling the rest above it. */}
      <SidebarShell isAdmin={access.isAdmin} fullName={access.fullName} email={access.email} />
      {/* The content area is its own detached white card, not flush against the grey
          shell — `m-1` (4px) gives it a gap on every side (top/right/bottom against the
          viewport, left against the sidebar), `rounded` is Tailwind's 4px radius step,
          and the arbitrary shadow value is deliberately asymmetric (a stronger,
          left-shifted shadow layer plus a lighter all-around one) since no shadow
          utility in the default scale can express "more on one edge." Per the redesign,
          2026-09-10. */}
      <main className="m-1 h-full flex-1 overflow-y-auto rounded bg-surface p-8 shadow-[-8px_0_20px_-6px_rgba(0,0,0,0.18),0_2px_10px_-2px_rgba(0,0,0,0.10)]">
        {children}
      </main>
    </div>
  );
}
