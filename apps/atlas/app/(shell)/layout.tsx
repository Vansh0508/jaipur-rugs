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
      {/* The content area is its own detached white card, floating against the grey
          shell with rounded-3xl corners, crisp border, and subtle elevation matching the reference design. */}
      <main className="my-2.5 mr-2.5 ml-1.5 flex-1 min-w-0 h-[calc(100vh-20px)] overflow-y-auto rounded-3xl border border-border/80 bg-surface p-6 lg:p-7 shadow-xs flex flex-col">
        {children}
      </main>
    </div>
  );
}
