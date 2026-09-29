import { describe, expect, it } from "vitest";
import { availableOrders, libraryCopies, mergeMapOrders } from "../lib/maps/importMaps";
import { applyMapAction } from "../lib/maps/actions";

const INV = ["Item No_", "Serial No_", "Location Code", "Rack No", "Box No", "Destroy Map", "Map Remarks", "Quality", "Design", "Ground Color", "Border Color", "Size", "Shape"];
const MAP = ["8/8", "EA-1533", "0908-40", "0903-40", "1'6X1'6", "Square"];
const ORD = ["Item No_", "Production Order No_", "Customer No_", "Order Priority", "Current Staus Pending Days", "Quality", "Design", "Size", "Shape", "MAP Item No_", "Map Item Description", "Follow Up Person"];
const order = (rug: string, po: string, map: string) => [rug, po, "0639", 0, 0, "8/8", "EA-1533", "1'6X1'6", "Square", map, "MAP Square", "VISHNU"];

describe("maps import", () => {
  const copies = libraryCopies([
    INV,
    ["MAP1", "1", "LOC-031", "23 - OLD", "D", "No", "", ...MAP],
    ["MAP1", "2", "LOC-031", "7 - OLD", "E", "No", " OK MAP", ...MAP],
    ["MAP1", "3", "LOC-181", "A-1", "A", "No", "", ...MAP],     // other location
    ["MAP1", "4", "LOC-031", "8 - OLD", "A", "Yes", "", ...MAP], // destroyed
    ["MAP2", "5", "LOC-031", "", "A", "No", "", ...MAP],         // no rack
    ["MAP3", "6", "LOC-031", "9 - OLD", "0", "No", "", ...MAP],  // box 0
  ]);

  it("keeps only usable MAP Library copies, every location", () => {
    expect(copies.get("MAP1")?.map((c) => `${c.rackNo}/${c.boxNo}`)).toEqual(["23 - OLD/D", "7 - OLD/E"]);
    expect(copies.get("MAP1")?.[1]).toMatchObject({ serialNo: "2", mapRemarks: "OK MAP", groundColor: "0908-40", borderColor: "0903-40", shape: "Square" });
    expect(copies.has("MAP2")).toBe(false);
    expect(copies.has("MAP3")).toBe(false);
  });

  it("lists only orders whose map is available, repeated rows collapse", () => {
    const orders = availableOrders([ORD, order("RUG1", "PO1", "MAP1"), order("RUG1", "PO1", "MAP1"), order("RUG2", "PO2", "MAP2")], copies);
    expect(orders.map((o) => o.id)).toEqual(["PO1|RUG1"]);
    expect(orders[0]?.copies).toHaveLength(2);
  });

  it("Req counts distinct orders needing the map, including ones with no copy listed", () => {
    const orders = availableOrders([ORD, order("RUG1", "PO1", "MAP1"), order("RUG1", "PO1", "MAP1"), order("RUG3", "PO3", "MAP1")], copies);
    expect(orders.map((o) => [o.id, o.required, o.copies.length])).toEqual([["PO1|RUG1", 2, 2], ["PO3|RUG3", 2, 2]]);
  });

  it("rejects the wrong file", () => {
    expect(() => availableOrders([["Foo"]], copies)).toThrow(/orders file/);
  });

  it("carries assignment across a refresh and drops orders no longer in the library, even assigned", () => {
    const [fresh] = availableOrders([ORD, order("RUG1", "PO1", "MAP1")], copies);
    const assigned = { ...fresh!, assignedTo: "Alpha", assignedAt: "t" };
    const gone = { ...fresh!, id: "PO9|RUG9", assignedTo: "Echo" };
    const unassignedGone = { ...fresh!, id: "PO8|RUG8" };
    const merged = mergeMapOrders([assigned, gone, unassignedGone], [fresh!]);
    expect(merged.map((o) => [o.id, o.assignedTo])).toEqual([["PO1|RUG1", "Alpha"]]);
  });

  it("manager assigns, only the assignee picks up, pickup is final", () => {
    const [fresh] = availableOrders([ORD, order("RUG1", "PO1", "MAP1")], copies);
    expect(() => applyMapAction(fresh!, { type: "assign", id: fresh!.id, sketcherName: "Alpha" }, { role: "sketcher", sketcherName: "Alpha" }, "t")).toThrow();
    expect(() => applyMapAction(fresh!, { type: "assign", id: fresh!.id, sketcherName: "Nobody" }, { role: "manager" }, "t")).toThrow();
    const assigned = applyMapAction(fresh!, { type: "assign", id: fresh!.id, sketcherName: "Alpha" }, { role: "manager" }, "t1");
    expect(() => applyMapAction(assigned, { type: "pickup", id: fresh!.id }, { role: "sketcher", sketcherName: "Echo" }, "t")).toThrow();
    const picked = applyMapAction(assigned, { type: "pickup", id: fresh!.id }, { role: "sketcher", sketcherName: "Alpha" }, "t2");
    expect(picked.pickedUpAt).toBe("t2");
    expect(() => applyMapAction(picked, { type: "assign", id: fresh!.id, sketcherName: "Echo" }, { role: "manager" }, "t")).toThrow();
    // A mistaken pickup: the sketcher can't undo it, the manager can.
    expect(() => applyMapAction(picked, { type: "undoPickup", id: fresh!.id }, { role: "sketcher", sketcherName: "Alpha" }, "t")).toThrow();
    expect(applyMapAction(picked, { type: "undoPickup", id: fresh!.id }, { role: "manager" }, "t").pickedUpAt).toBeUndefined();
  });

  it("never assigns more orders than there are copies, and the manager can pick up his own", () => {
    const [a, b, c] = availableOrders([ORD, order("RUG1", "PO1", "MAP1"), order("RUG2", "PO2", "MAP1"), order("RUG3", "PO3", "MAP1")], copies);
    const lead = { role: "manager" as const, sketcherName: "Foxtrot" };
    const one = applyMapAction(a!, { type: "assign", id: a!.id, sketcherName: "Alpha" }, lead, "t", [a!, b!, c!]);
    const two = applyMapAction(b!, { type: "assign", id: b!.id, sketcherName: "Foxtrot" }, lead, "t", [one, b!, c!]);
    expect(() => applyMapAction(c!, { type: "assign", id: c!.id, sketcherName: "Echo" }, lead, "t", [one, two, c!])).toThrow(/all 2 copies/);
    expect(applyMapAction(one, { type: "assign", id: a!.id, sketcherName: "Echo" }, lead, "t", [one, two, c!]).assignedTo).toBe("Echo"); // re-assign is fine
    expect(applyMapAction(two, { type: "pickup", id: b!.id }, lead, "t2").pickedUpAt).toBe("t2");
  });
});
