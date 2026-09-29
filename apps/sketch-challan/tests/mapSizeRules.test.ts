import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { addRulesFromWorkbook, emptyRules, formatFeetInches, mapSizeFor } from "../lib/mapSizeRules";

const book = (rows: Record<string, unknown>[], name: string) => {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, XLSX.utils.json_to_sheet(rows), name);
  return XLSX.write(b, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
};

// Small copies of the DND sheets (same headers as the real files).
const rules = emptyRules();
addRulesFromWorkbook(XLSX, book([
  { Quality: "3/20", "Map size (Full/Cut)": "Cut Size", SizeGroupInch: 48, "ShortWidth/LengthInch": 0, Remarks: "Length & Width Same" },
  { Quality: "3/20", "Map size (Full/Cut)": "Cut Size", SizeGroupInch: 600, "ShortWidth/LengthInch": 3, Remarks: "Length & Width Same" },
  { Quality: "8/8", "Map size (Full/Cut)": "Full Size", SizeGroupInch: 1200, "ShortWidth/LengthInch": 0, Remarks: "Length & Width Same" },
], "Master"), rules);
addRulesFromWorkbook(XLSX, book([
  { QualityGroup: "Tufted", SizeGroupInch: 54, ShortWidthInch: 1, Remarks: "Width" },
  { QualityGroup: "Tufted", SizeGroupInch: 114, ShortWidthInch: 2, Remarks: "Width" },
  { QualityGroup: "Tufted", SizeGroupInch: 54, ShortWidthInch: 1, Remarks: "Length" },
  { QualityGroup: "Tufted", SizeGroupInch: 114, ShortWidthInch: 2, Remarks: "Length" },
], "Tufted"), rules);

describe("map size rules", () => {
  it("knotted map is smaller, tufted map is bigger", () => {
    expect(mapSizeFor(rules, "3/20", 149, 197)).toMatchObject({ widthIn: 146, lengthIn: 194 });
    expect(mapSizeFor(rules, "3/20", 48, 48)).toMatchObject({ widthIn: 48, lengthIn: 48 });
    expect(mapSizeFor(rules, "Tufted Ultra HD", 59, 94)).toMatchObject({ widthIn: 61, lengthIn: 96 });
    expect(mapSizeFor(rules, "8/8 RWB", 146, 125)).toMatchObject({ widthIn: 146, lengthIn: 125 });
  });

  it("keeps order size and says why when no rule applies", () => {
    const result = mapSizeFor(rules, "Sumak", 60, 96);
    expect(result).toMatchObject({ widthIn: 60, lengthIn: 96 });
    expect(result.note).toContain("No map-size rule");
    expect(formatFeetInches(61)).toBe("5'1");
    expect(formatFeetInches(96)).toBe("8");
  });

  // Real DND workbooks, when present locally (data/ is gitignored).
  const dir = path.join(__dirname, "..", "data", "map-size-rules");
  const real = (name: string) => { try { return readFileSync(path.join(dir, name)); } catch { return null; } };
  const knotted = real("Map-Full Size Master- Knotted.xlsx");
  const lines = real("All_Qualities_8_Lines.xlsx");
  it.runIf(knotted && lines)("reads the real DND workbooks", () => {
    const live = emptyRules();
    for (const bytes of [knotted!, lines!]) addRulesFromWorkbook(XLSX, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, live);
    expect(mapSizeFor(live, "Tufted Ultra HD", 59, 94)).toMatchObject({ widthIn: 61, lengthIn: 96 });
    expect(mapSizeFor(live, "5/16", 149, 197)).toMatchObject({ widthIn: 146, lengthIn: 194 });
    expect(mapSizeFor(live, "80 LINE", 48, 72)).toMatchObject({ widthIn: 45, lengthIn: 69 });
    expect(mapSizeFor(live, "8/8", 146, 125)).toMatchObject({ widthIn: 146, lengthIn: 125 });
  });
});
