import type { ChosenCopy, MapAction, MapCopy, MapOrder, MapsState } from "./types";

// Rack management ticks the copy it pulls for an order; that copy then leaves every other order of the same map, so
// the next order only offers the copies left (29 Sep meeting). Admin unticks a mistake. Same rules in the browser
// (instant feedback) and on the server (app/api/maps-action), where the stored state wins.
export type MapsRole = "admin" | "rack";

export function applyMapAction(state: MapsState, action: MapAction, role: MapsRole, now: string): MapsState {
  const chosen = state.chosen ?? [];
  if (action.type === "unchoose") {
    if (role !== "admin") throw new Error("Only an admin can untick a copy.");
    if (!chosen.some((item) => item.orderId === action.orderId)) throw new Error("That order has no ticked copy.");
    return { ...state, chosen: chosen.filter((item) => item.orderId !== action.orderId) };
  }
  const order = state.orders.find((item) => item.id === action.orderId);
  if (!order) throw new Error("That order is no longer in the list. Refresh the page.");
  if (chosen.some((item) => item.orderId === order.id)) throw new Error(`${order.productionOrderNo} already has a copy ticked.`);
  const copy = remainingCopies(state, order).find((item) => item.serialNo === action.serialNo);
  if (!copy) throw new Error("That copy was already ticked for another order. Pick another one.");
  const pick: ChosenCopy = { orderId: order.id, productionOrderNo: order.productionOrderNo, mapItemNo: order.mapItemNo, serialNo: copy.serialNo, rackNo: copy.rackNo, boxNo: copy.boxNo, at: now };
  return { ...state, chosen: [...chosen, pick] };
}

// Copies of this order's map that no order has ticked yet.
export function remainingCopies(state: MapsState, order: MapOrder): MapCopy[] {
  const taken = new Set((state.chosen ?? []).filter((item) => item.mapItemNo === order.mapItemNo).map((item) => item.serialNo));
  // Maps saved before copies had ids (until the next refresh) get rack|box as a stand-in id.
  return order.copies.map((copy) => copy.serialNo ? copy : { ...copy, serialNo: `${copy.rackNo}|${copy.boxNo}` }).filter((copy) => !taken.has(copy.serialNo));
}

export interface MapRow extends MapOrder {
  left: MapCopy[];   // copies still in the rack for this order
  needed: number;    // orders of this map still waiting for a copy
  pick?: ChosenCopy; // the copy ticked for this order, if any
}

// The three tabs. Same map together (sorted by Map No), so the "needed / in rack" count reads down the column.
export function mapsView(state: MapsState): { inRack: MapRow[]; notAvailable: MapRow[]; chosen: MapRow[] } {
  const picks = new Map((state.chosen ?? []).map((item) => [item.orderId, item]));
  const waiting = new Map<string, number>();
  for (const order of state.orders) if (!picks.has(order.id)) waiting.set(order.mapItemNo, (waiting.get(order.mapItemNo) ?? 0) + 1);
  const rows = state.orders
    .map((order): MapRow => ({ ...order, left: remainingCopies(state, order), needed: waiting.get(order.mapItemNo) ?? 0, pick: picks.get(order.id) }))
    .sort((a, b) => a.mapItemNo.localeCompare(b.mapItemNo) || a.productionOrderNo.localeCompare(b.productionOrderNo));
  // A ticked copy whose order left the NAV list still counts as out of the rack; show it so an admin can untick it.
  const listed = new Set(state.orders.map((order) => order.id));
  const gone = (state.chosen ?? []).filter((item) => !listed.has(item.orderId)).map((item): MapRow => ({
    id: item.orderId, productionOrderNo: item.productionOrderNo, rugItemNo: "", quality: "", design: "", size: "", shape: "",
    groundColor: "", borderColor: "", mapItemNo: item.mapItemNo, action: "No longer in NAV-145", copies: [], left: [], needed: 0, pick: item,
  }));
  return {
    inRack: rows.filter((row) => !row.pick && row.left.length > 0),
    notAvailable: rows.filter((row) => !row.pick && row.left.length === 0),
    chosen: [...rows.filter((row) => row.pick), ...gone],
  };
}
