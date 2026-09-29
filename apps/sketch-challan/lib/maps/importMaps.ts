import * as XLSX from "xlsx";
import type { MapCopy, MapOrder } from "./types";

export const MAP_LIBRARY_LOCATION = "LOC-031";

type Grid = unknown[][];

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

// Header row → column index by exact NAV header name. A missing column is a wrong file, so fail loudly.
function columns<K extends string>(header: unknown[], names: Record<K, string>, file: string): Record<K, number> {
  const index = new Map(header.map((name, i) => [text(name), i]));
  const out = {} as Record<K, number>;
  for (const [key, name] of Object.entries(names) as [K, string][]) {
    const i = index.get(name);
    if (i === undefined) throw new Error(`${file} has no "${name}" column. Is it the right file?`);
    out[key] = i;
  }
  return out;
}

// Rows as plain arrays: NAV-028 is ~130k rows × 46 columns, objects per row would double the memory.
// ponytail: whole workbook in memory (~2 GB RSS for the 36 MB file); stream it if the dump keeps growing.
// Without a sheet name only the first sheet is parsed: the orders report NAV-145 also carries a ~400k-row
// "Map Inventory" sheet that would otherwise be read too.
export function sheetRows(buffer: ArrayBuffer, sheet?: string): Grid {
  const book = XLSX.read(buffer, { type: "array", dense: true, cellFormula: false, cellHTML: false, cellText: false, sheets: sheet ?? 0 });
  const name = sheet && book.Sheets[sheet] ? sheet : book.SheetNames[0]!;
  return XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name]!, { header: 1, defval: "" });
}

// MAP Library copies by map number. Destroyed maps and copies without a rack or box (blank or 0) are hidden.
export function libraryCopies(rows: Grid): Map<string, MapCopy[]> {
  const [header = [], ...body] = rows;
  const c = columns(header, {
    item: "Item No_", serial: "Serial No_", location: "Location Code", rack: "Rack No",
    box: "Box No", destroy: "Destroy Map", remarks: "Map Remarks", quality: "Quality", design: "Design",
    ground: "Ground Color", border: "Border Color", size: "Size", shape: "Shape",
  }, "The inventory file");
  const byMap = new Map<string, MapCopy[]>();
  for (const row of body) {
    if (text(row[c.location]) !== MAP_LIBRARY_LOCATION || text(row[c.destroy]) === "Yes") continue;
    const rackNo = text(row[c.rack]);
    const boxNo = text(row[c.box]);
    if (!rackNo || !boxNo || boxNo === "0") continue;
    const item = text(row[c.item]);
    if (!item) continue;
    const list = byMap.get(item) ?? [];
    list.push({
      serialNo: text(row[c.serial]), rackNo, boxNo, mapRemarks: text(row[c.remarks]),
      quality: text(row[c.quality]), design: text(row[c.design]), groundColor: text(row[c.ground]),
      borderColor: text(row[c.border]), size: text(row[c.size]), shape: text(row[c.shape]),
    });
    byMap.set(item, list);
  }
  return byMap;
}

// Orders whose map has at least one copy in the library. Repeated order rows collapse (last wins).
export function availableOrders(rows: Grid, copies: Map<string, MapCopy[]>): MapOrder[] {
  const [header = [], ...body] = rows;
  const c = columns(header, {
    rug: "Item No_", po: "Production Order No_", customer: "Customer No_", priority: "Order Priority",
    pending: "Current Staus Pending Days", map: "MAP Item No_", description: "Map Item Description",
    followUp: "Follow Up Person",
  }, "The orders file");
  const idOf = (row: unknown[]) => `${text(row[c.po])}|${text(row[c.rug])}`;
  // "Req" like the old COUNTIF on the orders sheet, but a repeated order row counts once.
  const needing = new Map<string, Set<string>>();
  for (const row of body) {
    const mapItemNo = text(row[c.map]);
    if (mapItemNo) needing.set(mapItemNo, (needing.get(mapItemNo) ?? new Set()).add(idOf(row)));
  }
  const byId = new Map<string, MapOrder>();
  for (const row of body) {
    const mapItemNo = text(row[c.map]);
    const found = copies.get(mapItemNo);
    if (!found?.length) continue;
    const id = idOf(row);
    byId.set(id, {
      id, rugItemNo: text(row[c.rug]), productionOrderNo: text(row[c.po]), mapItemNo, copies: found,
      required: needing.get(mapItemNo)!.size,
      customerNo: text(row[c.customer]), orderPriority: text(row[c.priority]), pendingDays: text(row[c.pending]),
      mapDescription: text(row[c.description]), followUpPerson: text(row[c.followUp]),
    });
  }
  return [...byId.values()];
}

// New dump wins for details and locations; the manager's assignment and the pickup carry over.
// An order no longer in the dump (its map left the library, or the order is done) is removed, even if assigned,
// so nobody is sent to a rack where the map no longer is (user decision, 2026-09-28).
export function mergeMapOrders(current: MapOrder[], incoming: MapOrder[]): MapOrder[] {
  const previous = new Map(current.map((order) => [order.id, order]));
  return incoming.map((order) => {
    const keep = previous.get(order.id);
    return keep ? { ...order, assignedTo: keep.assignedTo, assignedAt: keep.assignedAt, pickedUpAt: keep.pickedUpAt } : order;
  });
}
