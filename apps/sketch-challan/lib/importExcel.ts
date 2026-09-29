import type { SketchChallan } from "./domain/types";
import { mapSizeFor, type MapSizeRules } from "./mapSizeRules";
import { newId } from "./newId";

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const HEADER: Record<string, keyof SketchChallan | "size" | "action" | "skip"> = {
  "prod order no": "productionOrderNo",
  "map item no": "mapNo", // NAV-145 Design Map Planning
  "map no": "mapNo",
  "action to be taken": "action",
  "developed by": "developer",
  "map item description": "description",
  "ground color": "ground", // colour code; a later colour-name column (GR Color Name) wins
  "border color": "border",
  "map production order no": "productionOrderNo", // NAV-160 Map Routing Details
  "size": "size",
  "gr color name": "ground",
  "br color name": "border",
  "item description": "description",
  "development by": "developer",
  "substitute design": "substituteDesign",
  "design remarks": "managerRemark1",
  "production order no": "productionOrderNo",
  "production order number": "productionOrderNo",
  "po": "productionOrderNo",
  // No "challan date": it is the day the challan goes out, set by the app (29 Sep meeting).
  "draftsman": "draftsman",
  "drafts man": "draftsman",
  "sketch category": "sketchCategory",
  "category": "sketchCategory",
  "type of size": "sizeType",
  "size type": "sizeType",
  "developer": "developer",
  "order count": "orderCount",
  "design": "design",
  "ground": "ground",
  "border": "border",
  "matching code": "matchingCode",
  "quality": "quality",
  "shape": "shape",
  "map width": "mapWidthFt",
  "map width ft": "mapWidthFt",
  "map length": "mapLengthFt",
  "map length ft": "mapLengthFt",
  "area": "areaSqFt",
  "area sq ft": "areaSqFt",
  "quantity": "quantity",
  "description": "description",
  "due date": "dueDate",
};

// NAV size "4'11X7'10" → [59, 94] inches (width × length).
export function parseSizeInches(size: string): [number, number] | null {
  const parts = size.toUpperCase().split("X").map((part) => /^\s*(\d+(?:\.\d+)?)\s*(?:'\s*(\d+(?:\.\d+)?)?)?\s*"?\s*$/.exec(part));
  if (parts.length !== 2 || parts.some((match) => !match)) return null;
  const [width, length] = parts.map((match) => Number(match![1]) * 12 + Number(match![2] ?? 0));
  return [width!, length!];
}

const feet = (inches: number) => Math.round((inches / 12) * 100) / 100;

// NAV size "4'11X7'10" → [4.92, 7.83] decimal feet (width × length).
export function parseSize(size: string): [number, number] | null {
  const inches = parseSizeInches(size);
  return inches ? [feet(inches[0]), feet(inches[1])] : null;
}

function cell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

// With rules, NAV "Size" is the order size and map width/length come from the DND map-size rules.
// NAV-145: only rows whose "Action to be Taken" is Print or Available become challans.
const TAKEN_ACTIONS = new Set(["print", "available"]);
const SIZE_FIELDS = ["mapWidthFt", "mapLengthFt", "areaSqFt", "orderSize", "mapSizeNote", "mapSizeWhole"] as const;

export async function challansFromExcel(buffer: ArrayBuffer, rules?: MapSizeRules): Promise<SketchChallan[]> {
  const XLSX = await import("xlsx");
  // Only the first sheet is parsed: NAV-145 carries a ~570 MB "Map Inventory" sheet we never use.
  const book = XLSX.read(buffer, { type: "array", cellDates: true, dense: true, sheets: 0 });
  const name = book.SheetNames[0];
  if (!name) throw new Error("The Excel file has no sheets.");
  return challansFromRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[name]!, { defval: "" }), rules);
}

// Rows keyed by NAV column name: from an Excel sheet, or straight from the nav_mirror tables (same names).
export function challansFromRows(rows: Record<string, unknown>[], rules?: MapSizeRules): SketchChallan[] {
  // The map inventory (NAV-028) also has a "Production Order No" column; if it lands in this inbox it must not turn
  // 130k map copies into challans. Serial No + Location Code only appear in inventory reports.
  const headers = new Set(Object.keys(rows[0] ?? {}).map(norm));
  if (headers.has("serial no") && headers.has("location code")) throw new Error("No Production Order rows found in this Excel file (it is a map inventory report).");
  // Keyed by PO: a repeated Production Order in the dump keeps its first position, last row's values.
  const out = new Map<string, SketchChallan>();
  for (const raw of rows) {
    const mapped: Record<string, string> = {};
    for (const [header, value] of Object.entries(raw)) {
      const key = norm(header);
      const field = Object.hasOwn(HEADER, key) ? HEADER[key] : undefined;
      if (!field || field === "skip") continue;
      const text = cell(value);
      // Two columns can feed one field (Development By / Developed BY); a blank never hides a filled one.
      if (text || !(field in mapped)) mapped[field] = text;
    }
    const productionOrderNo = mapped.productionOrderNo ?? "";
    if (!productionOrderNo) continue;
    if ("action" in mapped && !TAKEN_ACTIONS.has(mapped.action!.toLowerCase())) continue;
    const order = mapped.size ? parseSizeInches(mapped.size) : null;
    const map = order && rules ? mapSizeFor(rules, mapped.quality ?? "", order[0], order[1]) : undefined;
    // Switch (off by default, 29 Sep meeting): map sizes in whole inches, .5 and up rounds up (9'7.5 -> 9'8).
    const whole = process.env.SKETCH_CHALLAN_ROUND_MAP_SIZE === "true";
    const inch = (value: number) => whole ? Math.round(value) : value;
    const widthIn = map ? inch(map.widthIn) : order ? inch(order[0]) : 0;
    const lengthIn = map ? inch(map.lengthIn) : order ? inch(order[1]) : 0;
    const width = Number(mapped.mapWidthFt) || feet(widthIn);
    const length = Number(mapped.mapLengthFt) || feet(lengthIn);
    // Only filled cells count as Excel-supplied: a blank cell (e.g. NAV's always-empty "Development By") never wipes a value.
    const excelFields = Object.keys(mapped).filter((field) => mapped[field] !== "" && field !== "size" && field !== "action") as (keyof SketchChallan)[];
    if (order) excelFields.push(...SIZE_FIELDS);
    out.set(productionOrderNo, {
      id: newId(),
      productionOrderNo,
      mapNo: mapped.mapNo ?? "",
      excelFields,
      challanDate: "",
      draftsman: mapped.draftsman ?? "",
      sketchCategory: mapped.sketchCategory ?? "",
      sizeType: mapped.sizeType ?? "",
      developer: mapped.developer ?? "",
      orderCount: Number(mapped.orderCount) || 1,
      design: mapped.design ?? "",
      ground: mapped.ground ?? "",
      border: mapped.border ?? "",
      matchingCode: mapped.matchingCode ?? "",
      substituteDesign: mapped.substituteDesign ?? "",
      quality: mapped.quality ?? "",
      shape: mapped.shape ?? "",
      mapWidthFt: width,
      mapLengthFt: length,
      orderSize: mapped.size || undefined,
      mapSizeNote: map?.note,
      mapSizeWhole: whole && Boolean(order) ? true : undefined,
      areaSqFt: Number(mapped.areaSqFt)
        || (map ? Math.round((widthIn * lengthIn) / 144 * 100) / 100 : Math.round(width * length * 100) / 100),
      quantity: Number(mapped.quantity) || 1,
      description: mapped.description ?? "",
      managerRemark1: mapped.managerRemark1 ?? "",
      managerRemark2: "",
      sketcherRemark: "",
      dueDate: mapped.dueDate ?? "",
      status: "active",
      priority: "normal",
      createdAt: new Date().toISOString(),
      tasks: [],
      activity: [{ id: newId(), message: "Excel refreshed.", at: new Date().toISOString() }],
    });
  }
  if (out.size === 0) throw new Error("No Production Order rows found in this Excel file.");
  return [...out.values()];
}

// Fields the manager owns once set; a live refresh only fills them while they are still blank.
const MANAGER_OWNED = new Set<keyof SketchChallan>(["managerRemark1", "managerRemark2", "sketcherRemark", "substituteDesign", "priority", "status"]);

const LABEL: Partial<Record<keyof SketchChallan, string>> = {
  mapWidthFt: "Map width", mapLengthFt: "Map length", areaSqFt: "Area", quantity: "Quantity", quality: "Quality",
  design: "Design", shape: "Shape", matchingCode: "Matching code", ground: "Ground", border: "Border", mapNo: "Map No",
};

// The Excel reports are live (refreshed ~4×/day): each refresh updates only the fields that report actually has,
// keeps everything the manager/sketchers did, and logs changes to challans that are already allotted.
export function mergeExcelRows(current: SketchChallan[], incoming: SketchChallan[]): SketchChallan[] {
  const previous = new Map(current.map((row) => [row.productionOrderNo, row]));
  const incomingPos = new Set(incoming.map((row) => row.productionOrderNo));
  // An allotted challan that drops out of the dump keeps its work history; unallotted ones follow the dump.
  const kept = current.filter((row) => row.tasks.length > 0 && !incomingPos.has(row.productionOrderNo));
  return [...kept, ...incoming.map((row) => {
    const keep = previous.get(row.productionOrderNo);
    if (!keep) return row;
    const next: SketchChallan = { ...keep, excelFields: row.excelFields };
    const changes: string[] = [];
    for (const field of row.excelFields ?? []) {
      const before = keep[field];
      if (MANAGER_OWNED.has(field) && before !== "" && before != null) continue;
      if (before === row[field]) continue;
      (next as unknown as Record<string, unknown>)[field] = row[field];
      if (LABEL[field]) changes.push(`${LABEL[field]}: ${before ?? "—"} → ${row[field] ?? "—"}`);
    }
    if (changes.length && keep.tasks.length) {
      next.activity = [{ id: newId(), message: `Live Excel changed ${changes.join("; ")}.`, at: new Date().toISOString() }, ...keep.activity];
    }
    return next;
  })];
}
