"use client";

import { useLocalPreference } from "@/lib/useLocalPreference";
import { SidebarNav } from "./SidebarNav";

// Owns the sidebar's expanded/collapsed state — a real click toggle persisted per device (not
// a CSS hover-to-expand), same as every department app. No UserMenu below the nav: there's
// no login here, so nobody to show or sign out.
export function SidebarShell() {
  const [expanded, setExpanded] = useLocalPreference("employee-portal:sidebarExpanded", true);

  return (
    <div
      className={
        "flex h-full shrink-0 flex-col overflow-hidden bg-app transition-[width] duration-200 ease-in-out " + (expanded ? "w-72" : "w-16")
      }
    >
      <SidebarNav expanded={expanded} onToggleExpanded={() => setExpanded((prev) => !prev)} />
    </div>
  );
}
