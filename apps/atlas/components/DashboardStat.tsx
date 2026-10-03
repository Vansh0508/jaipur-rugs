"use client";

import Link from "next/link";
import { CountUp } from "@jaipur-rugs/ui-kit";

/** `href` makes the whole tile a link (to the Orders list pre-filtered to what this
 * number counts) — direct feedback: every dashboard box should be clickable. */
export function DashboardStat({
  label,
  value,
  suffix,
  href,
}: {
  label: string;
  value: number;
  suffix?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-foreground">
        <CountUp value={value} suffix={suffix} />
      </div>
    </>
  );
  const base = "block rounded-xl border-2 border-border p-4";
  if (!href) return <div className={base}>{body}</div>;
  return (
    <Link
      href={href}
      title={`Show these in Orders`}
      className={`${base} transition-colors hover:border-accent hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent`}
    >
      {body}
    </Link>
  );
}
