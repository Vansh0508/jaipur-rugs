"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavLink {
  href: string;
  label: string;
}

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/orders", label: "Orders" },
    ...(isAdmin ? [{ href: "/merchants", label: "Merchants" }] : []),
  ];

  return (
    <nav aria-label="Primary" className="flex w-56 shrink-0 flex-col gap-1 border-r-2 border-border p-4">
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
    </nav>
  );
}
