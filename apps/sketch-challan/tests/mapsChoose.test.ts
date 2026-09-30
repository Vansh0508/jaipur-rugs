import { describe, expect, it } from "vitest";
import { applyMapAction, mapsView } from "../lib/maps/choose";
import type { MapOrder, MapsState } from "../lib/maps/types";

const copy = (serialNo: string, rackNo: string, boxNo: string) => ({ serialNo, rackNo, boxNo });
const order = (id: string, mapItemNo: string, copies: ReturnType<typeof copy>[]): MapOrder => ({
  id, productionOrderNo: id, rugItemNo: "RUG", quality: "8/8", design: "D", size: "8X10", shape: "RCT",
  groundColor: "G", borderColor: "B", mapItemNo, action: "Available", copies,
});
const MAP1 = [copy("s1", "5 - OLD", "A"), copy("s2", "6 - OLD", "B")];
const state: MapsState = { orders: [order("PO1", "MAP1", MAP1), order("PO2", "MAP1", MAP1), order("PO3", "MAP1", MAP1), order("PO4", "MAP9", [])] };

describe("ticking map copies (29 Sep meeting)", () => {
  it("sorts into In rack / Not available, with needed and in-rack counts per map", () => {
    const view = mapsView(state);
    expect(view.inRack.map((row) => [row.id, row.needed, row.left.length])).toEqual([["PO1", 3, 2], ["PO2", 3, 2], ["PO3", 3, 2]]);
    expect(view.notAvailable.map((row) => row.id)).toEqual(["PO4"]);
    expect(view.chosen).toEqual([]);
  });

  it("a ticked copy moves to Chosen and leaves every other order of the same map", () => {
    const one = applyMapAction(state, { type: "choose", orderId: "PO1", serialNo: "s1" }, "rack", "t1");
    let view = mapsView(one);
    expect(view.chosen.map((row) => [row.id, row.pick?.rackNo])).toEqual([["PO1", "5 - OLD"]]);
    expect(view.inRack.map((row) => [row.id, row.needed, row.left.map((c) => c.serialNo)])).toEqual([["PO2", 2, ["s2"]], ["PO3", 2, ["s2"]]]);
    expect(() => applyMapAction(one, { type: "choose", orderId: "PO2", serialNo: "s1" }, "rack", "t")).toThrow(/already ticked/);
    const two = applyMapAction(one, { type: "choose", orderId: "PO2", serialNo: "s2" }, "rack", "t2");
    view = mapsView(two);
    expect(view.notAvailable.map((row) => row.id)).toEqual(["PO3", "PO4"]); // PO3: both copies went to other orders
  });

  it("only an admin can untick, and the copy comes back", () => {
    const one = applyMapAction(state, { type: "choose", orderId: "PO1", serialNo: "s1" }, "rack", "t1");
    expect(() => applyMapAction(one, { type: "unchoose", orderId: "PO1" }, "rack", "t")).toThrow(/Only an admin/);
    const back = applyMapAction(one, { type: "unchoose", orderId: "PO1" }, "admin", "t");
    expect(mapsView(back).inRack.find((row) => row.id === "PO2")?.left).toHaveLength(2);
  });

  it("a ticked copy whose order left NAV still counts as out and stays in Chosen", () => {
    const one = applyMapAction(state, { type: "choose", orderId: "PO1", serialNo: "s1" }, "rack", "t1");
    const refreshed: MapsState = { ...one, orders: one.orders.filter((row) => row.id !== "PO1") };
    const view = mapsView(refreshed);
    expect(view.chosen.map((row) => row.id)).toEqual(["PO1"]);
    expect(view.inRack.find((row) => row.id === "PO2")?.left.map((c) => c.serialNo)).toEqual(["s2"]);
  });
});
