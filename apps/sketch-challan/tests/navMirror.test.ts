import { describe, expect, it, vi } from "vitest";
import { actionToBeTaken } from "../lib/nav/actionToBeTaken";
import { challansFromRows } from "../lib/importExcel";

vi.mock("server-only", () => ({}));
const { toGrid } = await import("../lib/nav/mirror");

const L = (library: boolean, design: boolean, matching: boolean, designSize: boolean, matchingSize: boolean) => ({ library, design, matching, designSize, matchingSize });

describe("Action to be Taken (NAV-145 Excel formula)", () => {
  it("follows the sheet's IFs in order", () => {
    expect(actionToBeTaken(L(true, false, false, false, false))).toBe("Available");
    expect(actionToBeTaken(L(false, true, true, true, true))).toBe("Print");
    expect(actionToBeTaken(L(false, true, false, false, true))).toBe("Sketch & Matching");
    expect(actionToBeTaken(L(false, true, true, false, false))).toBe("Sketch & Color Copy");
    expect(actionToBeTaken(L(false, true, false, true, false))).toBe("Matching");
    expect(actionToBeTaken(L(false, true, true, true, false))).toBe("Color Copy");
    expect(actionToBeTaken(L(false, false, false, false, false))).toBe("Sketch & Matching");
    expect(actionToBeTaken(L(false, true, false, false, false))).toBe("Matching");
    expect(actionToBeTaken(L(false, false, true, false, false))).toBe("");
  });
});

describe("rows straight from nav_mirror", () => {
  it("become challans like the Excel rows (bigint as text, dates as Date, Print/Available only)", () => {
    const rows = challansFromRows([
      { "Production Order No_": "JR/PRD-WV-1", "MAP Item No_": "MAP1", Quality: "5/16", Size: "8X10", Shape: "RCT", Design: "RE-7004", "Order Priority": "1", "Posting Date": new Date("2026-09-29"), "Action to be Taken": "Print", "Developed BY": "RND" },
      { "Production Order No_": "JR/PRD-WV-2", "MAP Item No_": "MAP2", Quality: "5/16", Size: "8X10", Shape: "RCT", Design: "RE-7004", "Action to be Taken": "Sketch & Matching" },
      { "Production Order No_": "JR/PRD-WV-3", "MAP Item No_": "MAP3", Quality: "5/16", Size: "8X10", Shape: "RCT", Design: null, "Action to be Taken": "Available" },
    ]);
    expect(rows.map((row) => [row.productionOrderNo, row.mapNo, row.developer])).toEqual([["JR/PRD-WV-1", "MAP1", "RND"], ["JR/PRD-WV-3", "MAP3", ""]]);
  });

  it("turn into an Excel-like grid for the Maps readers", () => {
    expect(toGrid({ columns: ["Item No_", "Rack No"], rows: [{ "Item No_": "MAP1", "Rack No": null }] })).toEqual([["Item No_", "Rack No"], ["MAP1", ""]]);
  });
});
