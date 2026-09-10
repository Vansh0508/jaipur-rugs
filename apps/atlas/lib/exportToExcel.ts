import * as XLSX from "xlsx";

/** Tiny shared wrapper around the same SheetJS/xlsx call `ExportOrdersButton.tsx`
 * already used for its whole-list export — factored out 2026-09-10 so the new
 * selected-rows-only export in `SelectionActionBar.tsx` (used by both OrdersTable.tsx
 * and RugLensTable.tsx) doesn't repeat the three-line workbook-building dance. Each
 * caller still builds its own plain-object row shape (column headers, formatting) —
 * this only does the write-to-file part. */
export function exportRowsToExcel(rows: Record<string, unknown>[], sheetName: string, filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}
