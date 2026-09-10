"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { AccessIcon, AlertsIcon, DashboardIcon, MerchantsIcon, OrdersIcon, RugLensIcon } from "./icons";

interface NavLink {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

// `id="page-sidebar-extra"` below is a portal target — a page can render extra content
// (currently just the Orders filter panel) directly into this same sidebar strip via
// OrdersFilterPanel's createPortal, rather than as a visually separate floating box.
// Direct feedback, 2026-09-05: "keep the filters in the same side bar below My access."
//
// The whole nav is its own independently-scrolling, viewport-pinned column (h-screen +
// sticky top-0 + overflow-y-auto) — so it (and anything portaled into it) stays in view
// while the main content area scrolls, instead of scrolling away with the page. Direct
// feedback, same round: "keep the panel freeze even while scrolling."
//
// Width/border/collapse-transition live on the shared wrapper in (shell)/layout.tsx now,
// not here — this component only reacts to that wrapper's hover state via the
// `group-hover/sidebar:` classes below (see that layout's comment for why it's a named
// group). Every label is wrapped so it's invisible and un-clickable-through-transparency
// while collapsed (`opacity-0` alone still keeps hidden text hoverable/tabbable, which
// would be confusing at 64px wide) but fades in together with the panel's own expansion.
export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
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
      <div className="mb-4 flex h-5 items-center px-2 text-sm font-semibold whitespace-nowrap text-foreground">
        <span className="opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">Atlas</span>
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
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-150 group-hover/sidebar:max-w-xs group-hover/sidebar:opacity-100">
                  {link.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div
        id="page-sidebar-extra"
        className="mt-2 flex flex-col gap-3 border-t-2 border-border pt-4 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100"
      />
    </nav>
  );
}
