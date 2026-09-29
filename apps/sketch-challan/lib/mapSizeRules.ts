// Map size from order size, using DND's two rule workbooks:
//  - "Map-Full Size Master- Knotted.xlsx" (sheet Master): per knotted quality, e.g. "3/20".
//  - "All_Qualities_8_Lines.xlsx" (sheets "Indo Nepali", "Tufted").
// Each rule row is a size band (upper limit in inches) and the inches to adjust.
// Knotted and Indo Nepali: map is SMALLER than order. Tufted: map is BIGGER than order.
import type * as XlsxModule from "xlsx";

type Band = [limitInch: number, adjustInch: number];
interface RuleSet { source: string; sign: -1 | 1; width: Band[]; length: Band[] }
export interface MapSizeRules { knotted: Map<string, RuleSet>; lines: Map<string, RuleSet>; tufted?: RuleSet }

export interface MapSizeResult { widthIn: number; lengthIn: number; note: string }

const num = (value: unknown) => Number(value);
const sorted = (bands: Band[]) => bands.filter(([limit, adjust]) => Number.isFinite(limit) && Number.isFinite(adjust)).sort((a, b) => a[0] - b[0]);

export function emptyRules(): MapSizeRules {
  return { knotted: new Map(), lines: new Map() };
}

// Adds whichever rule sheets this workbook contains; sheets are recognised by their headers, not file names.
export function addRulesFromWorkbook(XLSX: typeof XlsxModule, buffer: ArrayBuffer, rules: MapSizeRules) {
  const book = XLSX.read(buffer, { type: "array" });
  for (const name of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[name]!, { defval: "" });
    const headers = Object.keys(rows[0] ?? {});
    if (headers.includes("ShortWidth/LengthInch")) {
      const byQuality = new Map<string, { width: Band[]; length: Band[]; kind: string }>();
      for (const row of rows) {
        const quality = String(row.Quality).trim();
        if (!quality) continue;
        const entry = byQuality.get(quality) ?? { width: [], length: [], kind: String(row["Map size (Full/Cut)"]).trim() };
        const band: Band = [num(row.SizeGroupInch), num(row["ShortWidth/LengthInch"])];
        const remark = String(row.Remarks).trim().toLowerCase();
        if (remark !== "length") entry.width.push(band);
        if (remark !== "width") entry.length.push(band);
        byQuality.set(quality, entry);
      }
      for (const [quality, entry] of byQuality) {
        rules.knotted.set(quality.toLowerCase(), { source: `Knotted ${entry.kind || ""}`.trim(), sign: -1, width: sorted(entry.width), length: sorted(entry.length) });
      }
    } else if (headers.includes("SHORT WIDTH")) {
      const byQuality = new Map<string, RuleSet>();
      for (const row of rows) {
        const quality = String(row.Quality).trim().toLowerCase();
        if (!quality) continue;
        const set = byQuality.get(quality) ?? { source: "Indo Nepali", sign: -1, width: [], length: [] };
        const band: Band = [num(row["SIZE GROUP IN INCHES"]), num(row["SHORT WIDTH"])];
        (String(row.INCHES).trim().toLowerCase() === "length" ? set.length : set.width).push(band);
        byQuality.set(quality, set);
      }
      for (const [quality, set] of byQuality) rules.lines.set(quality, { ...set, width: sorted(set.width), length: sorted(set.length) });
    } else if (headers.includes("ShortWidthInch")) {
      const set: RuleSet = { source: "Tufted", sign: 1, width: [], length: [] };
      for (const row of rows) {
        const band: Band = [num(row.SizeGroupInch), num(row.ShortWidthInch)];
        (String(row.Remarks).trim().toLowerCase() === "length" ? set.length : set.width).push(band);
      }
      rules.tufted = { ...set, width: sorted(set.width), length: sorted(set.length) };
    }
  }
}

// "8/8 RWB" falls back to "8/8"; anything starting "Tuf" uses the Tufted sheet.
function ruleSetFor(rules: MapSizeRules, quality: string): RuleSet | undefined {
  const q = quality.trim().toLowerCase();
  if (!q) return undefined;
  if (q.startsWith("tuf")) return rules.tufted;
  return rules.lines.get(q) ?? rules.knotted.get(q) ?? rules.knotted.get(q.split(/\s+/)[0]!);
}

const adjustFor = (bands: Band[], inches: number) => bands.find(([limit]) => inches <= limit)?.[1];

export function formatFeetInches(inches: number): string {
  const whole = Math.round(inches);
  const feet = Math.floor(whole / 12);
  const rest = whole % 12;
  return rest ? `${feet}'${rest}` : `${feet}`;
}

// Map width/length for display: 9'8 when the sizes are whole inches (the rounding switch), else the decimal feet.
export function showMapFeet(feet: number, whole?: boolean): string {
  return whole && feet ? formatFeetInches(feet * 12) : String(feet);
}

export function mapSizeFor(rules: MapSizeRules, quality: string, widthIn: number, lengthIn: number): MapSizeResult {
  const order = `${formatFeetInches(widthIn)}X${formatFeetInches(lengthIn)}`;
  const set = ruleSetFor(rules, quality);
  if (!set) return { widthIn, lengthIn, note: `No map-size rule for quality "${quality || "blank"}"; map = order size ${order}.` };
  const w = adjustFor(set.width, widthIn);
  const l = adjustFor(set.length, lengthIn);
  if (w === undefined || l === undefined) {
    return { widthIn, lengthIn, note: `${set.source}: order size ${order} is outside the rule bands; map = order size.` };
  }
  const sign = set.sign === 1 ? "+" : "-";
  return {
    widthIn: widthIn + set.sign * w,
    lengthIn: lengthIn + set.sign * l,
    note: `Order size ${order} · ${set.source}: ${sign}${w} in width, ${sign}${l} in length.`,
  };
}
