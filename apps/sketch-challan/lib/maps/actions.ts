import type { ActionUser } from "@/lib/domain/actions";
import { DEMO_SKETCHERS } from "../demoData";
import type { MapAction, MapOrder } from "./types";

// Same shape as the challan actions: the browser applies it for instant feedback, the server re-applies it.
// `orders` is the whole list, needed to know how many copies of a map other orders already hold.
export function applyMapAction(order: MapOrder, action: MapAction, user: ActionUser, now: string, orders: MapOrder[] = []): MapOrder {
  switch (action.type) {
    case "assign": {
      // The manager (and admin) assign or re-assign until the map has been picked up.
      if (user.role === "sketcher") throw new Error("Only the Sketching Manager assigns maps.");
      if (order.pickedUpAt) throw new Error("This map was already picked up.");
      if (!DEMO_SKETCHERS.includes(action.sketcherName)) throw new Error("Choose a sketcher from the list.");
      if (!order.copies.length) throw new Error(`${order.mapItemNo || "This order"} has no copy in the map library (LOC-031).`);
      // One copy serves one order: never send two people for the last copy. Re-assigning uses no extra copy.
      const holders = orders.filter((other) => other.id !== order.id && other.mapItemNo === order.mapItemNo && other.assignedTo);
      if (!order.assignedTo && holders.length >= order.copies.length) {
        const copies = order.copies.length === 1 ? "the only copy" : `all ${order.copies.length} copies`;
        throw new Error(`${order.mapItemNo}: ${copies} already assigned (${holders.map((other) => other.assignedTo).join(", ")}).`);
      }
      return { ...order, assignedTo: action.sketcherName, assignedAt: now };
    }
    case "pickup": {
      // The assigned person: a sketcher, or the manager when he took the map himself.
      if (user.role === "admin" || order.assignedTo !== user.sketcherName) throw new Error("Only the assigned person can mark this picked up.");
      if (order.pickedUpAt) throw new Error("Already marked picked up.");
      return { ...order, pickedUpAt: now };
    }
    case "undoPickup": {
      // A mistaken "Picked up" is the manager's or admin's to correct.
      if (user.role === "sketcher") throw new Error("Ask the manager to undo a pickup.");
      if (!order.pickedUpAt) throw new Error("This map isn't marked picked up.");
      const { pickedUpAt: _pickedUpAt, ...rest } = order;
      return rest;
    }
  }
}

export function ordersForSketcher(orders: MapOrder[], sketcherName: string): MapOrder[] {
  return orders.filter((order) => order.assignedTo === sketcherName);
}
