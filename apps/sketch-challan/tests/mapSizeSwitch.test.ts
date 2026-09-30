import { afterEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { challansFromRows } from "../lib/importExcel";
import { addRulesFromWorkbook, emptyRules, showMapFeet } from "../lib/mapSizeRules";

const rules = emptyRules();
const b = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(b, XLSX.utils.json_to_sheet([
  { Quality: "5/5", "Map size (Full/Cut)": "Cut Size", SizeGroupInch: 600, "ShortWidth/LengthInch": 1.5, Remarks: "Length & Width Same" },
]), "Master");
addRulesFromWorkbook(XLSX, XLSX.write(b, { type: "array", bookType: "xlsx" }) as ArrayBuffer, rules);
const row = { "Production Order No_": "JR/PRD-WV-1", "MAP Item No_": "MAP1", Quality: "5/5", Size: "12'5X16'5", Design: "D", "Action to be Taken": "Print" };

describe("whole-inch map size switch (SKETCH_CHALLAN_ROUND_MAP_SIZE)", () => {
  afterEach(() => { delete process.env.SKETCH_CHALLAN_ROUND_MAP_SIZE; });

  it("off (default): the half inch stays, sizes show as decimal feet", () => {
    const [challan] = challansFromRows([row], rules); // 149 x 197 in, minus 1.5 = 147.5 x 195.5
    expect(challan).toMatchObject({ mapWidthFt: 12.29, mapLengthFt: 16.29 });
    expect(challan!.mapSizeWhole).toBeUndefined();
    expect(showMapFeet(challan!.mapWidthFt, challan!.mapSizeWhole)).toBe("12.29");
  });

  it("on: .5 and up rounds up to whole inches, shown as feet'inches", () => {
    process.env.SKETCH_CHALLAN_ROUND_MAP_SIZE = "true";
    const [challan] = challansFromRows([row], rules); // 148 x 196 in
    expect(challan).toMatchObject({ mapWidthFt: 12.33, mapLengthFt: 16.33, mapSizeWhole: true, areaSqFt: 201.44 });
    expect(showMapFeet(challan!.mapWidthFt, true)).toBe("12'4");
    expect(showMapFeet(challan!.mapLengthFt, true)).toBe("16'4");
  });
});
