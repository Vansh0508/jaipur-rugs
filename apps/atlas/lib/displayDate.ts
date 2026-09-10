// Extracted from OrdersTable.tsx, 2026-09-10, so RugLensTable can show/copy dates the
// same way without redefining this. A handful of date columns display the raw ERP
// value directly (unlike onTimeStatus/stageStandard, which already compute against it)
// — this keeps those displays (and the copy-to-Excel/email output) from showing
// "1753-01-01" (SQL Server's DateTime.MinValue, the ERP's own "no date set" placeholder,
// confirmed live 2026-09-07) as if it were a real date. orders-sync.mjs now converts
// this to null at the source going forward, but rows not yet re-synced still carry the
// stale value until the next sync run.
export function displayDate(value: string | null | undefined): string {
  if (!value) return "—";
  return Number(value.slice(0, 4)) < 1900 ? "—" : value;
}
