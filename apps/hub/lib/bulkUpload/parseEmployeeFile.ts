import * as XLSX from "xlsx";

/** Every field the bulk-upload flow understands, as raw trimmed strings — resolution
 * (department/role/manager name → id, employment_type text → enum) happens one layer up
 * in resolveRows.ts, which is the only place that needs to know about departments/roles/
 * the team directory. Blank/unmapped cells come through as "". None of these are required
 * to be present — a row missing a given field just means that field stays unset; the only
 * fields that end up mattering are decided per-row in resolveRows.ts (e.g. a brand-new
 * employee still needs a name and email to actually be created, but an update to an
 * existing employee found by employee_code needs neither). */
export interface ParsedEmployeeRow {
  fullName: string;
  email: string;
  department: string;
  managerEmail: string;
  role: string;
  employmentType: string;
  employeeCode: string;
}

/** The raw shape of an uploaded sheet, before the uploader has said which of their file's
 * own columns corresponds to which of the fields above — see fieldMapping.ts. */
export interface ParsedSheet {
  /** Column headers exactly as they appear in the file — whatever text the uploader's own
   * spreadsheet uses, not normalized to our field names. */
  headers: string[];
  /** One record per data row, keyed by the original header text, values trimmed to string. */
  rows: Record<string, string>[];
}

/** Reads an uploaded `.csv` or `.xlsx` file and returns its header row plus its data rows
 * (first sheet only — bulk upload has no notion of multiple sheets). `XLSX.read`
 * auto-detects CSV vs. the zip-based xlsx format from the buffer itself, so one code path
 * covers both without inspecting the file extension. This does not yet know which column
 * means what — that's decided afterward, in the mapping step (fieldMapping.ts), which is
 * why this only returns headers + raw rows rather than `ParsedEmployeeRow`s directly. */
export async function parseEmployeeFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return { headers: [], rows: [] };

  // Header row read separately (rather than Object.keys() on the first data row) so a
  // file with headers but zero data rows still reports its columns correctly.
  const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? [];
  const headers = headerRow.map((header) => String(header ?? "").trim()).filter((header) => header.length > 0);

  const rawRecords = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const rows = rawRecords.map((rawRow) => {
    const row: Record<string, string> = {};
    for (const [header, value] of Object.entries(rawRow)) {
      row[header] = String(value ?? "").trim();
    }
    return row;
  });

  return { headers, rows };
}
