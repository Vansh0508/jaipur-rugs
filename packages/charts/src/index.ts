// Bklit chart components (AGENTS.md Section 2 / 4). Every app builds charts through this
// package rather than configuring Bklit ad hoc, so chart styling/behavior stays consistent
// across department apps.
//
// Bklit is distributed as a shadcn registry — source copied into the consuming repo, not an
// npm package (`@bklitui/ui` 404s on npm; see https://bklit.com/docs/installation). The
// Bar Chart and Pie Chart items are vendored under ./bklit, unmodified apart from two
// things: `@/lib/utils` became a relative import (the `@/` alias is per-app), and
// useNumberFlowElementReady in charts/chart-stat-flow.tsx starts false on the client (marked
// "LOCAL FIX") — upstream's version caused an SSR hydration mismatch in the pie centre.
// To add another chart (or refresh these), re-fetch its item from
// https://ui.bklit.com/r/<name>.json, copy in any new files + dependencies, and re-apply both.
// Theme variables: ./chart-theme.css (mapped onto Hero UI tokens).

export { BarChart, type BarChartProps } from "./bklit/charts/bar-chart";
export { Bar, type BarProps } from "./bklit/charts/bar";
export { BarXAxis, type BarXAxisProps } from "./bklit/charts/bar-x-axis";
export { Grid, type GridProps } from "./bklit/charts/grid";
export { ChartTooltip, type ChartTooltipProps } from "./bklit/charts/tooltip";
export { PieChart, type PieChartProps } from "./bklit/charts/pie-chart";
export { PieSlice, type PieSliceProps } from "./bklit/charts/pie-slice";
export { PieCenter, type PieCenterProps } from "./bklit/charts/pie-center";
export type { PieData } from "./bklit/charts/pie-context";
