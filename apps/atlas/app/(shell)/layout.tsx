import type { ReactNode } from "react";
import { headers } from "next/headers";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireAtlasStaffAccess } from "@/lib/auth/requireAtlasStaffAccess";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { UserMenu } from "@/components/shell/UserMenu";

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
    <div className="fixed inset-0 flex overflow-hidden">
      {/* UserMenu keeps its natural height; SidebarNav fills whatever's left
          (flex-1) and scrolls internally on its own (see that component's comment) —
          so it, and anything portaled into it, never scrolls away with the page.
          Direct feedback, 2026-09-05: "keep the panel freeze even while scrolling." */}
      <div className="flex h-full flex-col">
        <UserMenu fullName={access.fullName} />
        <SidebarNav isAdmin={access.isAdmin} />
      </div>
      <main className="h-full flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
