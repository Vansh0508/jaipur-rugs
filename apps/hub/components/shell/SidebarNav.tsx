"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronIcon, DependenciesIcon, ProfileIcon, TeamIcon } from "./icons";

// Hero UI v3 removed Navbar entirely — see apps/admin/internal-portal/components/shell/SidebarNav.tsx's
// comment, this is the same hand-built pattern.

interface NavLink {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

// Matches apps/atlas/components/shell/SidebarNav.tsx's pattern one-for-one (Gravity UI
// icons, collapsible width, portal-free) so every department app's launcher/nav strip
// looks and behaves the same (AGENTS.md Section 1: "every department app looks,
// authenticates, and queries the same way"). Width/collapse-transition live on the shared
// wrapper in SidebarShell.tsx, not here — this component receives that wrapper's
// `expanded` boolean as a prop. Every label is wrapped so it's invisible and
// un-clickable-through-transparency while collapsed (`opacity-0` alone still keeps hidden
// text hoverable/tabbable) but fades in together with the panel's own expansion.
export function SidebarNav({
  canManageTeam,
  canManageDependencies,
  expanded,
  onToggleExpanded,
}: {
  canManageTeam: boolean;
  canManageDependencies: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/profile", label: "Profile", icon: ProfileIcon },
    ...(canManageTeam ? [{ href: "/team", label: "Team", icon: TeamIcon }] : []),
    ...(canManageDependencies
      ? [{ href: "/settings", label: "Manage Dependencies", icon: DependenciesIcon }]
      : []),
  ];

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
      <div className="mb-4 flex h-5 items-center justify-between px-2 text-sm font-semibold whitespace-nowrap text-foreground">
        <span
          className={
            "overflow-hidden transition-[max-width,opacity] duration-150 " +
            (expanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0")
          }
        >
          Hub
        </span>
        <button
          type="button"
          onClick={onToggleExpanded}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-secondary hover:text-foreground"
        >
          <ChevronIcon className={"h-4 w-4 transition-transform duration-200 " + (expanded ? "" : "rotate-180")} />
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                title={link.label}
                className={
                  "flex items-center gap-3 rounded-lg py-1.5 pl-1.5 pr-3 text-sm transition-colors " +
                  (isActive ? "font-medium text-accent" : "text-muted hover:text-foreground")
                }
              >
                <span
                  className={
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors " +
                    (isActive ? "bg-accent/10" : "hover:bg-surface-secondary")
                  }
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={
                    "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-150 " +
                    (expanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0")
                  }
                >
                  {link.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
