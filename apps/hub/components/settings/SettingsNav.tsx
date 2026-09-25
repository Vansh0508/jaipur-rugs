"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function SettingsNav({
  canManageDepartments,
  canManageRoles,
  canManageApps,
}: {
  canManageDepartments: boolean;
  canManageRoles: boolean;
  canManageApps: boolean;
}) {
  const pathname = usePathname();

  const tabs = [
    ...(canManageDepartments ? [{ href: "/settings/departments", label: "Departments" }] : []),
    ...(canManageRoles ? [{ href: "/settings/roles", label: "Roles" }] : []),
    ...(canManageApps ? [{ href: "/settings/apps", label: "Apps" }] : []),
  ];

  return (
    <nav aria-label="Manage Dependencies" className="flex gap-1 border-b-2 border-border">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={
              "-mb-0.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
              (isActive ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
