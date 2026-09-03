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
    <div className="flex min-h-screen">
      <div className="flex flex-col">
        <SidebarNav isAdmin={access.isAdmin} />
        <UserMenu fullName={access.fullName} />
      </div>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
