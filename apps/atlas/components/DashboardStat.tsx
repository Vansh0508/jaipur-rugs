"use client";

import { CountUp } from "@jaipur-rugs/ui-kit";

export function DashboardStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border-2 border-border p-5">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-foreground">
        <CountUp value={value} suffix={suffix} />
      </div>
    </div>
  );
}
