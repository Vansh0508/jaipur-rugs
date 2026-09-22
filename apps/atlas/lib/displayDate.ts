// Extracted from OrdersTable.tsx, 2026-09-10, so RugLensTable can show/copy dates the
// same way without redefining this. A handful of date columns display the raw ERP
// value directly (unlike onTimeStatus/stageStandard, which already compute against it)
// — this keeps those displays (and the copy-to-Excel/email output) from showing
// "1753-01-01" (SQL Server's DateTime.MinValue, the ERP's own "no date set" placeholder,
// confirmed live 2026-09-07) as if it were a real date. orders-sync.mjs now converts
// this to null at the source going forward, but rows not yet re-synced still carry the
// stale value until the next sync run.
//
// Format: DD-MMM-YY (e.g. "17-SEP-26") — direct request, Back Ops walkthrough
// (transcript reviewed 2026-09-22): "for Indian's sake... us hisaab se hum log ekdum
// jaldi grasp kar lete hain, kyunki hamara India ke andar standard format DDMMMYY hai."
// Accepts either a bare "YYYY-MM-DD" date or a full ISO timestamp — only the first 10
// characters are ever read, so both shapes work without a separate helper.
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function displayDate(value: string | null | undefined): string {
  if (!value) return "—";
  const datePart = value.slice(0, 10);
  const year = Number(datePart.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return "—";
  const month = Number(datePart.slice(5, 7));
  const day = Number(datePart.slice(8, 10));
  if (!month || !day || month < 1 || month > 12) return "—";
  return `${String(day).padStart(2, "0")}-${MONTHS[month - 1]}-${String(year).slice(-2)}`;
}
