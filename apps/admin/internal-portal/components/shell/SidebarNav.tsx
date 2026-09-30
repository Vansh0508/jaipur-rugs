"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { CarsIcon, ChevronIcon, ConferenceIcon, DashboardIcon, DriversIcon, JourneysIcon } from "./icons";

// Hero UI v3 removed Navbar entirely (its own migration guide says to hand-build
// navigation with native <nav>/Tailwind) — this is that hand-built nav, not a workaround.
// A left sidebar rather than a top bar: a small, stable set of sections (4 today) is a
// better fit than a horizontal bar competing with each page's own primary action button
// (PageHeader's "Plan new journey" / "Add car" / "Add driver").
//
// Matches apps/hub/components/shell/SidebarNav.tsx and apps/atlas's one-for-one (Gravity
// UI icons, collapsible width) — the standard department app shell. Width/collapse
// transition live on the wrapper in SidebarShell.tsx; this component only receives its
// `expanded` boolean. Collapsed labels are width- AND opacity-collapsed (`max-w-0
// opacity-0`), since `opacity-0` alone leaves invisible text hoverable/tabbable.

interface NavLink {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/journeys", label: "Journeys", icon: JourneysIcon },
  { href: "/cars", label: "Cars", icon: CarsIcon },
  { href: "/drivers", label: "Drivers", icon: DriversIcon },
  { href: "/conference", label: "Conference", icon: ConferenceIcon },
];

export function SidebarNav({ expanded, onToggleExpanded }: { expanded: boolean; onToggleExpanded: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
      <div className="mb-4 flex h-5 items-center justify-between px-2 text-sm font-semibold whitespace-nowrap text-foreground">
        <span
          className={
            "overflow-hidden transition-[max-width,opacity] duration-150 " +
            (expanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0")
          }
        >
          Internal Portal
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
        {NAV_LINKS.map((link) => {
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
