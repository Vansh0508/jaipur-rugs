"use client";

import { useLocalPreference } from "@/lib/useLocalPreference";
import { SidebarNav } from "./SidebarNav";
import { UserMenu } from "./UserMenu";

// Owns the sidebar's expanded/collapsed state — added 2026-09-10 replacing the old
// CSS-only `hover:w-72` behavior (see (shell)/layout.tsx's previous comment) with a real
// click-to-toggle button (SidebarNav's chevron) per direct feedback: "add a collapse
// icon which expands and collapses on demand." Needs to be a client component (state +
// localStorage) even though the shell layout above it is a server component, so it's
// split out on its own rather than folded into (shell)/layout.tsx directly.
//
// Defaults to expanded on a device with no stored preference yet — more discoverable
// than starting collapsed. Persisted per device (see lib/useLocalPreference.ts), same
// mechanism the column-visibility and filter-bar-visibility toggles use.
export function SidebarShell({
  isAdmin,
  fullName,
  email,
}: {
  isAdmin: boolean;
  fullName: string;
  email: string | null;
}) {
  const [expanded, setExpanded] = useLocalPreference("atlas:sidebarExpanded", true);

  return (
    <div
      className={
        "flex h-full shrink-0 flex-col overflow-hidden bg-app transition-[width] duration-200 ease-in-out " +
        (expanded ? "w-72" : "w-16")
      }
    >
      <SidebarNav isAdmin={isAdmin} expanded={expanded} onToggleExpanded={() => setExpanded((prev) => !prev)} />
      <UserMenu fullName={fullName} email={email} expanded={expanded} />
    </div>
  );
}
