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

// MAP Library copies by map number: only rack and box. Destroyed maps and copies without a rack or box (blank or 0)
// are hidden.
export function libraryCopies(rows: Grid): Map<string, MapCopy[]> {
  const [header = [], ...body] = rows;
  const c = columns(header, { item: "Item No_", location: "Location Code", rack: "Rack No", box: "Box No", destroy: "Destroy Map" }, "The inventory file");
  const byMap = new Map<string, MapCopy[]>();
  for (const row of body) {
    if (text(row[c.location]) !== MAP_LIBRARY_LOCATION || text(row[c.destroy]) === "Yes") continue;
    const rackNo = text(row[c.rack]);
    const boxNo = text(row[c.box]);
    const item = text(row[c.item]);
    if (!rackNo || !boxNo || boxNo === "0" || !item) continue;
    byMap.set(item, [...(byMap.get(item) ?? []), { rackNo, boxNo }]);
  }
  return byMap;
}

// NAV-145 rows whose "Action to be Taken" is Print or Available (like the challans), each with its map's library copies.
// A row without a Production Order No is skipped, as for the challans. Repeated order rows collapse (last wins).
const TAKEN = new Set(["print", "available"]);
export function mapOrders(rows: Grid, copies: Map<string, MapCopy[]>): MapOrder[] {
  const [header = [], ...body] = rows;
  const c = columns(header, {
    rug: "Item No_", po: "Production Order No_", quality: "Quality", design: "Design", size: "Size", shape: "Shape",
    ground: "Ground Color", border: "Border Color", map: "MAP Item No_", action: "Action to be Taken",
  }, "The orders file");
  const byId = new Map<string, MapOrder>();
  for (const row of body) {
    const productionOrderNo = text(row[c.po]);
    const action = text(row[c.action]);
    if (!productionOrderNo || !TAKEN.has(action.toLowerCase())) continue;
    const mapItemNo = text(row[c.map]);
    const id = `${productionOrderNo}|${text(row[c.rug])}`;
    byId.set(id, {
      id, productionOrderNo, mapItemNo, action, copies: copies.get(mapItemNo) ?? [],
      quality: text(row[c.quality]), design: text(row[c.design]), size: text(row[c.size]), shape: text(row[c.shape]),
      groundColor: text(row[c.ground]), borderColor: text(row[c.border]),
    });
  }
  return [...byId.values()];
}
