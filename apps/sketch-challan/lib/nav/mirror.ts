import "server-only";

import { Pool } from "pg";
import { actionToBeTaken } from "./actionToBeTaken";

// The NAV reports, copied into the server's own Supabase (schema nav_mirror) by /home/idmt/scheduler.py several times
// a day. Read only, with a login that can only SELECT (deploy/sketch-challan/office-deploy.md). Column names are the
// NAV / Excel header names, so the Excel readers work on these rows unchanged. Unset NAV_DB_URL = use the Excel inbox.
export const mirrorEnabled = () => Boolean(process.env.NAV_DB_URL);

const TABLES = {
  nav145: process.env.NAV_TABLE_145 || "NAV-145 - Design Map Planning Report",
  nav160: process.env.NAV_TABLE_160 || "NAV-160 - Map Routing Details - Sketch Checking and Development",
  inventory: process.env.NAV_TABLE_028 || "NAV-028 - Map Serial Inventory",
  library: process.env.NAV_TABLE_028_LIBRARY || "NAV-028 - Map Serial Inventory - Map Library",
};
const table = (name: string) => `nav_mirror."${name.replace(/"/g, '""')}"`;

let pool: Pool | undefined;
function db() {
  // ponytail: one small pool per server process; the app is a single PM2 instance.
  return (pool ??= new Pool({ connectionString: process.env.NAV_DB_URL, max: 3, connectionTimeoutMillis: 10_000, statement_timeout: 120_000 }));
}

export interface MirrorResult { columns: string[]; rows: Record<string, unknown>[] }

// Each copy drops the table and renames a fresh one into place, so a read can land in the gap: retry a few times.
async function read(sql: string, label: string): Promise<MirrorResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      const result = await db().query(sql);
      return { columns: result.fields.map((field) => field.name), rows: result.rows };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "42P01" && attempt === 3) {
        const names = await db().query("select table_name from information_schema.tables where table_schema = 'nav_mirror' order by 1").catch(() => ({ rows: [] }));
        throw new Error(`${label} isn't in nav_mirror. Tables there: ${names.rows.map((row) => row.table_name).join(", ") || "none"}. Set NAV_TABLE_* in .env.local.`);
      }
      if (attempt === 3) throw new Error(`Could not read ${label} from the NAV database: ${(error as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}

export function nav160Rows() {
  return read(`select * from ${table(TABLES.nav160)}`, "NAV-160");
}

// NAV-145 plus the Excel's "Action to be Taken", from the same lookups the sheet does (case-insensitive like VLOOKUP).
export async function nav145Rows(): Promise<MirrorResult> {
  const inv = table(TABLES.inventory);
  const result = await read(`
    select o.*,
      (lower(o."Matching Code"), lower(o."Size"), lower(o."Shape")) in (select lower("Matching Code"), lower("Size"), lower("Shape") from ${table(TABLES.library)}) as "_library",
      lower(o."Design") in (select lower("Design") from ${inv}) as "_design",
      lower(o."Matching Code") in (select lower("Matching Code") from ${inv}) as "_matching",
      (lower(o."Design"), lower(o."Size"), lower(o."Shape")) in (select lower("Design"), lower("Size"), lower("Shape") from ${inv}) as "_designSize",
      (lower(o."Matching Code"), lower(o."Size"), lower(o."Shape")) in (select lower("Matching Code"), lower("Size"), lower("Shape") from ${inv}) as "_matchingSize"
    from ${table(TABLES.nav145)} o`, "NAV-145");
  const flags = ["_library", "_design", "_matching", "_designSize", "_matchingSize"];
  return {
    columns: [...result.columns.filter((name) => !flags.includes(name)), "Action to be Taken"],
    rows: result.rows.map((row) => {
      const { _library, _design, _matching, _designSize, _matchingSize, ...rest } = row;
      const action = actionToBeTaken({ library: !!_library, design: !!_design, matching: !!_matching, designSize: !!_designSize, matchingSize: !!_matchingSize });
      return { ...rest, "Action to be Taken": action };
    }),
  };
}

// Only what the Maps screen needs from the ~130k-row inventory: LOC-031 copies and where they are.
export function libraryLocationRows() {
  return read(`select "Item No_", "Serial No_", "Location Code", "Rack No", "Box No", "Destroy Map", "Map Remarks" from ${table(TABLES.inventory)} where "Location Code" = 'LOC-031'`, "NAV-028 Map Serial Inventory");
}

// The Maps readers take a header row + value rows, like an Excel sheet.
export const toGrid = ({ columns, rows }: MirrorResult): unknown[][] => [columns, ...rows.map((row) => columns.map((name) => row[name] ?? ""))];
