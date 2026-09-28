"use client";

import { useLocalPreference } from "@/lib/useLocalPreference";
import { SidebarNav } from "./SidebarNav";
import { UserMenu } from "./UserMenu";

// Owns the sidebar's expanded/collapsed state — same split as
// apps/hub/components/shell/SidebarShell.tsx: a client component (state + localStorage)
// under a server-component layout. A real click toggle persisted per device, not a CSS
// hover-to-expand (Atlas shipped that first; direct feedback replaced it). Defaults to
// expanded on a device with no stored preference yet.
export function SidebarShell({ fullName, email }: { fullName: string; email: string }) {
  const [expanded, setExpanded] = useLocalPreference("internal-portal:sidebarExpanded", true);

  return (
    <div
      className={
        "flex h-full shrink-0 flex-col overflow-hidden bg-app transition-[width] duration-200 ease-in-out " +
        (expanded ? "w-72" : "w-16")
      }
    >
      <SidebarNav expanded={expanded} onToggleExpanded={() => setExpanded((prev) => !prev)} />
      <UserMenu fullName={fullName} email={email} expanded={expanded} />
    </div>
  );
}
