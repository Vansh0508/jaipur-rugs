import { describe, expect, it } from "vitest";
import { libraryCopies, mapOrders } from "../lib/maps/importMaps";

const INV = ["Item No_", "Serial No_", "Location Code", "Rack No", "Box No", "Destroy Map", "Map Remarks"];
const ORD = ["Item No_", "Production Order No_", "Customer No_", "Quality", "Design", "Ground Color", "Border Color", "Size", "Shape", "MAP Item No_", "Action to be Taken"];
const order = (rug: string, po: string, map: string, action = "Available") => [rug, po, "0639", "8/8", "EA-1533", "0908-40", "0903-40", "1'6X1'6", "Square", map, action];

describe("maps import", () => {
  const copies = libraryCopies([
    INV,
    ["MAP1", "1", "LOC-031", "23 - OLD", "D", "No", ""],
    ["MAP1", "2", "LOC-031", "7 - OLD", "E", "No", " OK MAP"],
    ["MAP1", "3", "LOC-181", "A-1", "A", "No", ""],     // other location
    ["MAP1", "4", "LOC-031", "8 - OLD", "A", "Yes", ""], // destroyed
    ["MAP2", "5", "LOC-031", "", "A", "No", ""],         // no rack
    ["MAP3", "6", "LOC-031", "9 - OLD", "0", "No", ""],  // box 0
  ]);

  it("keeps only rack and box of usable LOC-031 copies", () => {
    expect(copies.get("MAP1")).toEqual([{ rackNo: "23 - OLD", boxNo: "D" }, { rackNo: "7 - OLD", boxNo: "E" }]);
    expect(copies.has("MAP2")).toBe(false);
    expect(copies.has("MAP3")).toBe(false);
  });

  it("lists only Print and Available rows with a production order, with the NAV-145 details", () => {
    const orders = mapOrders([ORD,
      order("RUG1", "PO1", "MAP1"), order("RUG1", "PO1", "MAP1"),  // repeated row collapses
      order("RUG2", "PO2", "MAP9", "Print"),                          // Print, map not in the library
      order("RUG3", "PO3", "MAP1", "Sketch & Matching"),              // other actions are left out
      order("RUG4", "", "MAP1", "Print"),                             // no production order
    ], copies);
    expect(orders.map((o) => [o.id, o.action, o.copies.length])).toEqual([["PO1|RUG1", "Available", 2], ["PO2|RUG2", "Print", 0]]);
    expect(orders[0]).toMatchObject({ productionOrderNo: "PO1", quality: "8/8", design: "EA-1533", size: "1'6X1'6", shape: "Square", groundColor: "0908-40", borderColor: "0903-40", mapItemNo: "MAP1" });
  });

  it("rejects the wrong file", () => {
    expect(() => mapOrders([["Foo"]], copies)).toThrow(/orders file/);
  });

});
