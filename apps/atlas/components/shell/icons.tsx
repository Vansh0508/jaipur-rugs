// Small hand-rolled icon set for the sidebar's collapsed (icon-only) state — added
// 2026-09-07 alongside the hover-to-expand sidebar. No icon library added for just this
// handful of icons (matches the app's existing minimal-dependency approach — see
// orders-sync.mjs's own comment on only adding `mssql` when actually needed). Plain
// inline SVG, stroke-based, 20x20, inherits color via currentColor so it matches
// whatever text color the surrounding link/button already uses.

type IconProps = { className?: string };

const base = "shrink-0";

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className={`${base} ${className ?? ""}`}>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="4" rx="1" />
      <rect x="11" y="9" width="6" height="8" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
    </svg>
  );
}

export function OrdersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className={`${base} ${className ?? ""}`}>
      <rect x="4" y="2.5" width="12" height="15" rx="1.5" />
      <path d="M7 2.5h6v2.5H7z" fill="currentColor" stroke="none" />
      <path d="M7 9h6M7 12h6M7 6.5h2" strokeLinecap="round" />
    </svg>
  );
}

export function AlertsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className={`${base} ${className ?? ""}`}>
      <path d="M10 3a4 4 0 0 0-4 4v2.5c0 .8-.3 1.6-.9 2.2L4 13h12l-1.1-1.3c-.6-.6-.9-1.4-.9-2.2V7a4 4 0 0 0-4-4Z" strokeLinejoin="round" />
      <path d="M8.2 15.5a1.8 1.8 0 0 0 3.6 0" strokeLinecap="round" />
    </svg>
  );
}

export function MerchantsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className={`${base} ${className ?? ""}`}>
      <path d="M3 8l1-4h12l1 4" strokeLinejoin="round" />
      <path d="M3.5 8v7.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8" strokeLinejoin="round" />
      <path d="M3 8a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" strokeLinejoin="round" />
      <path d="M8 16.5V12a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4.5" strokeLinejoin="round" />
    </svg>
  );
}

export function RugLensIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className={`${base} ${className ?? ""}`}>
      <rect x="2.5" y="5" width="15" height="11" rx="1.5" />
      <circle cx="10" cy="10.5" r="3" />
      <path d="M7 5 8.2 3h3.6L13 5" strokeLinejoin="round" />
    </svg>
  );
}

export function AccessIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className={`${base} ${className ?? ""}`}>
      <circle cx="7" cy="7" r="3.5" />
      <path d="M9.5 9.5 16.5 16.5M13.5 12.5l2-2M15 14l1.5-1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className={`${base} ${className ?? ""}`}>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M3.5 17c.7-3.5 3.4-5.5 6.5-5.5s5.8 2 6.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

export function SignOutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className={`${base} ${className ?? ""}`}>
      <path d="M8 17H4.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 13.5 16 10l-3.5-3.5M16 10H7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
