"use client";

import { useMemo } from "react";
import { Card } from "@heroui/react";
import { PieCenter, PieChart, PieSlice } from "@jaipur-rugs/charts";
import type { StatusCount } from "@/lib/queries/dashboard";
import { EmptyState } from "@/components/shared/EmptyState";

// A Bklit donut for one fleet roster's status split (drivers, vehicles), with the total in
// the middle and a legend underneath that also lists the counts — so a zero slice (which
// draws nothing) is still visible. Slice colours carry meaning and come from the caller,
// as Hero UI tokens, so both themes follow the app.
export function StatusPieCard({
  title,
  counts,
  colors,
  note,
  emptyMessage,
}: {
  title: string;
  counts: StatusCount[];
  /** One CSS colour per entry in `counts`, same order. */
  colors: string[];
  /** Small clarification under the legend — what a bucket includes. */
  note?: string;
  emptyMessage: string;
}) {
  const total = counts.reduce((sum, c) => sum + c.value, 0);
  const data = useMemo(() => counts.map((c, i) => ({ label: c.label, value: c.value, color: colors[i] })), [counts, colors]);

  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col items-center gap-4">
        {total === 0 ? (
          <div className="w-full">
            <EmptyState message={emptyMessage} />
          </div>
        ) : (
          <PieChart data={data} size={170} innerRadius={58} padAngle={0.03} cornerRadius={4}>
            {data.map((slice, index) => (
              <PieSlice key={slice.label} index={index} />
            ))}
            <PieCenter defaultLabel="Total" />
          </PieChart>
        )}
        <ul className="flex w-full flex-col gap-1.5 text-sm">
          {counts.map((c, i) => (
            <li key={c.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-foreground">
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: colors[i] }} />
                {c.label}
              </span>
              <span className="font-medium tabular-nums text-foreground">{c.value}</span>
            </li>
          ))}
        </ul>
        {note ? <p className="w-full text-[11px] text-muted">{note}</p> : null}
      </Card.Content>
    </Card>
  );
}
