"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

// Hero UI v3 removed Navbar entirely (its own migration guide says to hand-build
// navigation with native <nav>/Tailwind) — this is that hand-built nav, not a workaround.
// A left sidebar rather than a top bar: a small, stable set of sections (4 today) is a
// better fit than a horizontal bar competing with each page's own primary action button
// (PageHeader's "Plan new journey" / "Add car" / "Add driver").

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/journeys", label: "Journeys" },
  { href: "/cars", label: "Cars" },
  { href: "/drivers", label: "Drivers" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex w-56 shrink-0 flex-col gap-1 border-r-2 border-border p-4">
      <div className="mb-4 px-2 text-sm font-semibold text-foreground">Internal Portal</div>
      <ul className="flex flex-col gap-1">
        {NAV_LINKS.map((link) => {
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
    </nav>
  );
}
