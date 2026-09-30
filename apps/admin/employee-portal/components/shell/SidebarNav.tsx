"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronIcon, ConferenceBookingIcon, JourneyBookingIcon } from "./icons";

// The standard department app sidebar (copied from apps/admin/internal-portal, itself from
// apps/hub / apps/atlas): Gravity UI icons, collapsible width, active-link highlighting.
// Collapsed labels are width- AND opacity-collapsed (`max-w-0 opacity-0`), since `opacity-0`
// alone leaves invisible text hoverable/tabbable.

interface NavLink {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

const NAV_LINKS: NavLink[] = [
  { href: "/journey-booking", label: "Journey Booking", icon: JourneyBookingIcon },
  { href: "/conference-booking", label: "Conference Booking", icon: ConferenceBookingIcon },
];

export function SidebarNav({ expanded, onToggleExpanded }: { expanded: boolean; onToggleExpanded: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
      <div className="mb-4 flex h-5 items-center justify-between px-2 text-sm font-semibold whitespace-nowrap text-foreground">
        <span
          className={
            "overflow-hidden transition-[max-width,opacity] duration-150 " + (expanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0")
          }
        >
          Employee Portal
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
