"use client";

import { useMemo } from "react";
import { Card } from "@heroui/react";
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid } from "@jaipur-rugs/charts";
import type { RideCountDay } from "@/lib/queries/dashboard";

// Journeys per day over the last two weeks (Bklit bar chart). The x values are real Dates
// (built at local noon, so the axis and the tooltip's date pill never slip a day), which is
// what Bklit expects for a date axis; the server sends plain yyyy-mm-dd strings.
export function RideCountsChart({ data, days }: { data: RideCountDay[]; days: number }) {
  const chartData = useMemo(() => data.map((d) => ({ date: new Date(`${d.date}T12:00:00`), rides: d.rides })), [data]);
  const total = data.reduce((sum, d) => sum + d.rides, 0);

  return (
    <Card className="lg:col-span-2">
      <Card.Header className="flex-row items-center justify-between gap-2">
        <Card.Title>Rides per day</Card.Title>
        <span className="text-xs text-muted">
          {total} {total === 1 ? "ride" : "rides"} · last {days} days
        </span>
      </Card.Header>
      <Card.Content>
        <BarChart
          data={chartData}
          xDataKey="date"
          aspectRatio="2.4 / 1"
          margin={{ top: 16, right: 12, bottom: 36, left: 12 }}
          barGap={0.35}
        >
          <Grid horizontal numTicksRows={4} />
          <Bar dataKey="rides" lineCap={4} />
          <BarXAxis maxLabels={7} />
          <ChartTooltip rows={(point) => [{ color: "var(--chart-line-primary)", label: "Rides", value: Number(point.rides) }]} />
        </BarChart>
      </Card.Content>
    </Card>
  );
}
