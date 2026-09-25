"use client";

import { useLocalPreference } from "@/lib/useLocalPreference";
import { SidebarNav } from "./SidebarNav";
import { UserMenu } from "./UserMenu";

// Owns the sidebar's expanded/collapsed state, same split as
// apps/atlas/components/shell/SidebarShell.tsx — a client component (state + localStorage)
// even though the shell layout above it is a server component. Defaults to expanded on a
// device with no stored preference yet.
export function SidebarShell({
  canManageTeam,
  canManageDependencies,
  fullName,
}: {
  canManageTeam: boolean;
  canManageDependencies: boolean;
  fullName: string;
}) {
  const [expanded, setExpanded] = useLocalPreference("hub:sidebarExpanded", true);

  return (
    <div
      className={
        "flex h-full shrink-0 flex-col overflow-hidden bg-app transition-[width] duration-200 ease-in-out " +
        (expanded ? "w-72" : "w-16")
      }
    >
      <SidebarNav
        canManageTeam={canManageTeam}
        canManageDependencies={canManageDependencies}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((prev) => !prev)}
      />
      <UserMenu fullName={fullName} expanded={expanded} />
    </div>
  );
}
