import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { challansFromExcel, mergeExcelRows, parseSize } from "../lib/importExcel";
import type { SketchChallan } from "../lib/domain/types";

describe("challansFromExcel", () => {
  it("maps PO rows and keeps remarks on refresh", async () => {
    const sheet = XLSX.utils.json_to_sheet([
      { "Prod. Order No": "PO-1", Design: "D-1", Quality: "Wool", "Map Width": 8, "Map Length": 10, Area: 80, Quantity: 1 },
      { Design: "skip me" },
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const incoming = await challansFromExcel(buffer);
    expect(incoming).toHaveLength(1);
    expect(incoming[0]?.productionOrderNo).toBe("PO-1");
    expect(incoming[0]?.design).toBe("D-1");

    const current = [{
      ...incoming[0]!,
      id: "keep",
      managerRemark1: "mgr",
      tasks: [{ id: "t", title: "part", assignedPart: "Border", sketcherName: "Aditi Sharma", status: "assigned" as const }],
    }] as SketchChallan[];
    const merged = mergeExcelRows(current, incoming);
    expect(merged[0]?.id).toBe("keep");
    expect(merged[0]?.managerRemark1).toBe("mgr");
    expect(merged[0]?.tasks).toHaveLength(1);
  });

  it("collapses repeated POs and ignores prototype-named headers", async () => {
    const sheet = XLSX.utils.json_to_sheet([
      { "Prod. Order No": "PO-1", Design: "old", constructor: "x", toString: "y" },
      { "Prod. Order No": "PO-2", Design: "two" },
      { "Prod. Order No": "PO-1", Design: "new" },
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
    const rows = await challansFromExcel(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    expect(rows.map((row) => [row.productionOrderNo, row.design])).toEqual([["PO-1", "new"], ["PO-2", "two"]]);
  });

  it("reads NAV-160 Map Routing Details columns", async () => {
    expect(parseSize("4'11X7'10")).toEqual([4.92, 7.83]);
    expect(parseSize("9X13")).toEqual([9, 13]);
    expect(parseSize("oval")).toBeNull();
    const sheet = XLSX.utils.json_to_sheet([{
      "MAP Production Order No_": "PDMAP2627/024123", Quality: "Tufted Ultra HD", Design: "TSWV-622", Shape: "RCT",
      Size: "4'11X7'10", Quantity: 2, "Matching Code": "TSWV-622-0002", "GR Color Name": "Antique White",
      "BR Color Name": "Light Peach", "Design Remarks": "AS PER CAD", "Substitute Design": "TAQ-643",
    }]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "NAV-160");
    const [row] = await challansFromExcel(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    expect(row).toMatchObject({
      productionOrderNo: "PDMAP2627/024123", mapWidthFt: 4.92, mapLengthFt: 7.83, areaSqFt: 38.52, quantity: 2,
      ground: "Antique White", border: "Light Peach", managerRemark1: "AS PER CAD", substituteDesign: "TAQ-643",
    });
  });

  it("NAV-145: keeps only Print/Available rows and reads the map number", async () => {
    const sheet = XLSX.utils.json_to_sheet([
      { "Production Order No_": "JR/PRD-WV-1", "MAP Item No_": "MAP1", Quality: "5/22", Size: "10X14", "Development By": "", "Developed BY": "RND", "Action to be Taken": "Print" },
      { "Production Order No_": "JR/PRD-WV-2", "MAP Item No_": "MAP2", Quality: "5/22", Size: "8X10", "Action to be Taken": "Available" },
      { "Production Order No_": "JR/PRD-WV-3", "MAP Item No_": "MAP3", Quality: "5/22", Size: "8X10", "Action to be Taken": "Sketch & Matching" },
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Map Planning");
    const rows = await challansFromExcel(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    expect(rows.map((row) => [row.productionOrderNo, row.mapNo])).toEqual([["JR/PRD-WV-1", "MAP1"], ["JR/PRD-WV-2", "MAP2"]]);
    expect(rows[0]?.developer).toBe("RND");
  });

  it("live refresh updates Excel fields only, keeps manager work, logs changes on allotted challans", async () => {
    const sheet = (quantity: number) => {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{ "Prod. Order No": "PO-9", Design: "D-9", Quantity: quantity }]), "S");
      return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    };
    const [first] = await challansFromExcel(sheet(1));
    const worked = {
      ...first!, sketchCategory: "Scale Hard", dueDate: "2026-10-01", managerRemark1: "keep me",
      tasks: [{ id: "t", title: "Border", assignedPart: "Border", sketcherName: "Echo", status: "in_progress" as const }],
    };
    const [merged] = mergeExcelRows([worked], await challansFromExcel(sheet(3)));
    expect(merged).toMatchObject({ id: worked.id, quantity: 3, sketchCategory: "Scale Hard", dueDate: "2026-10-01", managerRemark1: "keep me" });
    expect(merged?.tasks).toHaveLength(1);
    expect(merged?.activity[0]?.message).toContain("Quantity: 1 → 3");
  });

  it("a blank Excel cell never wipes an existing value", async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{ "Prod. Order No": "PO-7", "Development By": "", Quantity: "", Design: "D-7" }]), "S");
    const [incoming] = await challansFromExcel(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    const [merged] = mergeExcelRows([{ ...incoming!, developer: "DND", quantity: 4 }], [incoming!]);
    expect(merged).toMatchObject({ developer: "DND", quantity: 4, design: "D-7" });
  });

  it("refuses the map inventory (NAV-028) so its rows never become challans", async () => {
    const sheet = XLSX.utils.json_to_sheet([{ "Item No_": "MAP1", "Serial No_": "1", "Location Code": "LOC-031", "Production Order No": "TOMAPWH2627/0104", Design: "D" }]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "NAV-028");
    await expect(challansFromExcel(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer)).rejects.toThrow(/^No Production Order rows/);
  });
});
