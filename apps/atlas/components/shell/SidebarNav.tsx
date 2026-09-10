"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { AccessIcon, AlertsIcon, ChevronIcon, DashboardIcon, MerchantsIcon, OrdersIcon, RugLensIcon } from "./icons";

interface NavLink {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

// Filters used to portal into a `#page-sidebar-extra` slot here (direct feedback,
// 2026-09-05: "keep the filters in the same side bar below My access") — reversed
// 2026-09-10: filters now render above each table instead (see OrdersFilterPanel.tsx/
// RugLensFilterPanel.tsx), so that slot and the createPortal wiring are gone.
//
// The whole nav is its own independently-scrolling column (flex-1 + overflow-y-auto,
// inside the shared h-full sidebar wrapper in SidebarShell.tsx) — so it stays in view
// while the main content area scrolls, instead of scrolling away with the page. Direct
// feedback, 2026-09-05: "keep the panel freeze even while scrolling."
//
// Width/collapse-transition live on the shared wrapper in SidebarShell.tsx, not here —
// this component receives that wrapper's `expanded` boolean as a real prop now, not a
// CSS `:hover` pseudo-class (replaced 2026-09-10 per direct feedback: "add a collapse
// icon which expands and collapses on demand," not hover-driven). Every label is
// wrapped so it's invisible and un-clickable-through-transparency while collapsed
// (`opacity-0` alone still keeps hidden text hoverable/tabbable, which would be
// confusing at 64px wide) but fades in together with the panel's own expansion.
export function SidebarNav({
  isAdmin,
  expanded,
  onToggleExpanded,
}: {
  isAdmin: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
    { href: "/orders", label: "Orders", icon: OrdersIcon },
    { href: "/alerts", label: "Alerts", icon: AlertsIcon },
    // Shown to everyone with general Atlas access, same as Orders/Alerts — actual
    // access (Sales/Back Ops/admin, see requireRugLensAccess.ts) is gated by the page
    // itself, which shows a plain "restricted" notice rather than hiding the link
    // entirely (this component only knows `isAdmin`, not department grants).
    { href: "/rug-lens", label: "RugLens", icon: RugLensIcon },
    ...(isAdmin ? [{ href: "/merchants", label: "Merchants", icon: MerchantsIcon }] : []),
    { href: "/my-access", label: "My access", icon: AccessIcon },
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
          Atlas
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
                {/* Highlight lives on this fixed 32x32 box, not the row itself — the row
                    also contains the label span below, which stays in the DOM (just
                    width-collapsed) while hidden so it can transition back open; giving
                    IT a background too would highlight that full, mostly invisible
                    width instead of just the icon. Direct feedback, 2026-09-07: "the
                    blue color on the icon is not aligned" — this is what was misaligned. */}
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
