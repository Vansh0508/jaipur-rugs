import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_COOKIE, getDemoSession } from "@/lib/demoAuth";
import { env } from "@/lib/env";
import { libraryLocationRows, mirrorEnabled, nav145Rows, toGrid } from "@/lib/nav/mirror";
import { libraryCopies, mapOrders, sheetRows } from "@/lib/maps/importMaps";
import { updateMaps } from "@/lib/maps/mapsStore";

export const runtime = "nodejs";

const MAX_EXCEL_BYTES = 80 * 1024 * 1024; // NAV-028 is ~36 MB today
// One refresh at a time: each parse holds ~2 GB, so two at once could run the server out of memory.
// ponytail: per-process flag; fine for the single demo/office server process.
let running = false;
const EXCEL_EXT = new Set([".xlsx", ".xlsm", ".xls"]);

// The RPA bot drops NAV-028 into <inbox>/inventory (newest wins). Orders: see ordersReport().
function inboxDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.MAPS_EXCEL_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "maps-inbox"));
}

// The challan inbox, where NAV-145 already lands for Refresh Excel (same default as app/api/refresh-excel).
function challanInboxDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.SKETCH_CHALLAN_EXCEL_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "excel-inbox"));
}

async function excelFiles(dir: string) {
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const names = (await readdir(/*turbopackIgnore: true*/ dir)).filter((name) => !name.startsWith("~$") && EXCEL_EXT.has(path.extname(name).toLowerCase()));
  return Promise.all(names.map(async (name) => {
    const full = path.join(/*turbopackIgnore: true*/ dir, name);
    return { name, full, info: await stat(/*turbopackIgnore: true*/ full) };
  }));
}

// Orders = the newest report with a "MAP Item No_" column, from <inbox>/orders or the challan inbox. So one copy
// of NAV-145 (Design Map Planning) in the challan inbox serves both Refresh Excel and Maps.
async function ordersReport(): Promise<{ name: string; rows: unknown[][] }> {
  const dirs = [path.join(/*turbopackIgnore: true*/ inboxDir(), "orders"), challanInboxDir()];
  const files = (await Promise.all(dirs.map(excelFiles))).flat().sort((a, b) => b.info.mtimeMs - a.info.mtimeMs);
  for (const file of files) {
    if (file.info.size > MAX_EXCEL_BYTES) continue;
    const bytes = await readFile(/*turbopackIgnore: true*/ file.full);
    const rows = sheetRows(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    if ((rows[0] ?? []).some((cell) => String(cell).trim() === "MAP Item No_")) return { name: file.name, rows };
  }
  throw new Error(`No orders report with a "MAP Item No_" column (NAV-145) in ${dirs.join(" or ")}.`);
}

async function newestExcel(dir: string, label: string): Promise<{ name: string; bytes: ArrayBuffer }> {
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const names = (await readdir(/*turbopackIgnore: true*/ dir)).filter((name) => !name.startsWith("~$") && EXCEL_EXT.has(path.extname(name).toLowerCase()));
  if (!names.length) throw new Error(`No ${label} Excel in ${dir}.`);
  const withInfo = await Promise.all(names.map(async (name) => ({ name, info: await stat(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, name)) })));
  const { name, info } = withInfo.sort((a, b) => b.info.mtimeMs - a.info.mtimeMs)[0]!;
  if (info.size > MAX_EXCEL_BYTES) throw new Error(`${name} is larger than 80 MB.`);
  const file = await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, name));
  return { name, bytes: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer };
}

export async function POST() {
  // Maps only exist in the local demo store until the Supabase tables land (same as challans).
  if (!env.demoMode) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = getDemoSession((await cookies()).get(DEMO_COOKIE)?.value);
  if (session?.role !== "admin") return NextResponse.json({ error: "Only the admin can refresh maps." }, { status: 403 });
  if (running) return NextResponse.json({ error: "A maps refresh is already running. Try again in a minute." }, { status: 409 });
  running = true;
  try {
    // The NAV database (nav_mirror) when it is set up, else the Excel inbox.
    let copies, incoming, files;
    if (mirrorEnabled()) {
      copies = libraryCopies(toGrid(await libraryLocationRows()));
      incoming = mapOrders(toGrid(await nav145Rows()), copies);
      files = { inventory: "NAV database: NAV-028 Map Serial Inventory", orders: "NAV-145" };
    } else {
      const inventory = await newestExcel(path.join(/*turbopackIgnore: true*/ inboxDir(), "inventory"), "inventory (NAV-028)");
      const ordersFile = await ordersReport();
      copies = libraryCopies(sheetRows(inventory.bytes, "NAV-028"));
      incoming = mapOrders(ordersFile.rows, copies);
      files = { inventory: inventory.name, orders: ordersFile.name };
    }
    const state = await updateMaps((current) => {
      const next = {
        orders: incoming, // the order list follows NAV; ticked copies stay
        chosen: current.chosen ?? [],
        refreshedAt: new Date().toISOString(),
        files,
      };
      return { state: next, result: next };
    });
    return NextResponse.json({ ...state, available: incoming.filter((order) => order.copies.length).length });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    const message = code === "EBUSY" || code === "EPERM"
      ? "An Excel file is open or locked. Close it in Excel and try again."
      : err instanceof Error ? err.message : "Could not read the maps inbox.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    running = false;
  }
}
