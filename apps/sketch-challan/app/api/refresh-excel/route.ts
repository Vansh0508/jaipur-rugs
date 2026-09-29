import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_COOKIE, getDemoSession } from "@/lib/demoAuth";
import * as XLSX from "xlsx";
import { env } from "@/lib/env";
import { challansFromExcel, challansFromRows, mergeExcelRows } from "@/lib/importExcel";
import { mirrorEnabled, nav145Rows, nav160Rows } from "@/lib/nav/mirror";
import type { SketchChallan } from "@/lib/domain/types";
import { updateRows } from "@/lib/demoStore";
import { addRulesFromWorkbook, emptyRules, type MapSizeRules } from "@/lib/mapSizeRules";
import { requireSketchChallanAccess } from "@/lib/auth/requireSketchChallanAccess";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";

export const runtime = "nodejs";

// NAV-145 is ~67 MB (a huge unused inventory sheet); only its first sheet is parsed.
const MAX_EXCEL_BYTES = 150 * 1024 * 1024;
const EXCEL_EXT = new Set([".xlsx", ".xlsm", ".xls", ".csv"]);

function inboxDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.SKETCH_CHALLAN_EXCEL_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "excel-inbox"));
}

function rulesDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.SKETCH_CHALLAN_MAP_RULES_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "map-size-rules"));
}

const toArrayBuffer = (bytes: Buffer) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

// Every Excel in the rules folder is read on each refresh, so DND can edit the rule files in place.
async function loadMapSizeRules(): Promise<MapSizeRules> {
  const dir = rulesDir();
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const rules = emptyRules();
  for (const name of await readdir(/*turbopackIgnore: true*/ dir)) {
    if (name.startsWith("~$") || !EXCEL_EXT.has(path.extname(name).toLowerCase())) continue;
    addRulesFromWorkbook(XLSX, toArrayBuffer(await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, name))), rules);
  }
  return rules;
}

// Every report in the inbox is read (NAV-160, NAV-145, ...), oldest first, so a newer report wins a shared PO.
// Office "~$" lock files are skipped.
async function reportFiles(dir: string): Promise<string[]> {
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const files = (await readdir(/*turbopackIgnore: true*/ dir)).filter((name) => !name.startsWith("~$") && EXCEL_EXT.has(path.extname(name).toLowerCase()));
  if (!files.length) throw new Error("No NAV reports in the Excel inbox yet.");
  const withTime = await Promise.all(files.map(async (name) => ({ name, mtime: (await stat(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, name))).mtimeMs })));
  return withTime.sort((a, b) => a.mtime - b.mtime).map((entry) => entry.name);
}

export async function POST() {
  // Only the Sketching Manager refreshes (AGENTS.md). The reply carries every challan, so no one else may call it.
  const isManager = env.demoMode
    ? getDemoSession((await cookies()).get(DEMO_COOKIE)?.value)?.role === "manager"
    : (await requireSketchChallanAccess(await getServerSupabaseClient())).roleKeys.includes("sketching_manager");
  if (!isManager) return NextResponse.json({ error: "Only the Sketching Manager can refresh the Excel." }, { status: 403 });
  // Supabase mode: the merge still has to be sent to the sketch-challan-create Edge Function (README go-live plan).
  // Until then say so, instead of returning unsaved rows that would replace the real ones on screen.
  if (!env.demoMode) return NextResponse.json({ error: "Refresh is not connected to the database yet." }, { status: 501 });
  try {
    const rules = await loadMapSizeRules();
    const byPo = new Map<string, SketchChallan>();
    const used: string[] = [];
    // The NAV database (nav_mirror) when it is set up, else the Excel inbox. NAV-145 is read last, so it wins a shared PO.
    const reports = mirrorEnabled() ? [["NAV-160", nav160Rows], ["NAV-145", nav145Rows]] as const : [];
    for (const [label, load] of reports) {
      const { rows: source } = await load();
      let rows: SketchChallan[] = [];
      try { rows = challansFromRows(source, rules); } catch { /* no Production Order rows in this report right now */ }
      used.push(`${label} (${rows.length})`);
      for (const row of rows) byPo.set(row.productionOrderNo, row);
    }
    const dir = inboxDir();
    for (const name of mirrorEnabled() ? [] : await reportFiles(dir)) {
      const full = path.join(/*turbopackIgnore: true*/ dir, name);
      if ((await stat(/*turbopackIgnore: true*/ full)).size > MAX_EXCEL_BYTES) throw new Error(`${name} is larger than 150 MB.`);
      let rows: SketchChallan[];
      try {
        rows = await challansFromExcel(toArrayBuffer(await readFile(/*turbopackIgnore: true*/ full)), rules);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("No Production Order rows")) continue; // not a challan report
        throw err;
      }
      used.push(`${name} (${rows.length})`);
      for (const row of rows) byPo.set(row.productionOrderNo, row);
    }
    if (!byPo.size) throw new Error(mirrorEnabled() ? "No Production Order rows in NAV-160 or NAV-145 right now." : "No Production Order rows found in the Excel inbox.");
    const incoming = [...byPo.values()];
    const file = (mirrorEnabled() ? "NAV database: " : "") + used.join(", ");
    // Demo: merge into the shared store so every login sees the same refreshed rows.
    const rows = await updateRows((current) => { const merged = mergeExcelRows(current, incoming); return { rows: merged, result: merged }; });
    return NextResponse.json({ file, rows, read: incoming.length });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    const message = code === "EBUSY" || code === "EPERM"
      ? "The Excel file is open or locked. Close it in Excel and try again."
      : err instanceof Error && !code ? err.message : "Could not read the Excel inbox.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
