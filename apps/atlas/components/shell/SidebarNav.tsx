"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavLink {
  href: string;
  label: string;
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
export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/orders", label: "Orders" },
    { href: "/alerts", label: "Alerts" },
    ...(isAdmin ? [{ href: "/merchants", label: "Merchants" }] : []),
    { href: "/my-access", label: "My access" },
  ];

  return (
    <nav
      aria-label="Primary"
      className="flex w-72 shrink-0 flex-1 flex-col gap-1 overflow-y-auto border-r-2 border-border p-4"
    >
      <div className="mb-4 px-2 text-sm font-semibold text-foreground">Atlas</div>
      <ul className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  "block rounded-lg px-3 py-2 text-sm transition-colors " +
                  (isActive
                    ? "bg-accent/10 font-medium text-accent"
                    : "text-muted hover:bg-surface-secondary hover:text-foreground")
                }
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div id="page-sidebar-extra" className="mt-2 flex flex-col gap-3 border-t-2 border-border pt-4" />
    </nav>
  );
}
