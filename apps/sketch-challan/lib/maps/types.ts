// Maps tab: NAV-145 orders to Print or with a map Available, and where each map copy is in the
// MAP Library (NAV-028, LOC-031). The manager assigns an order to a sketcher, who collects it and marks it picked up.

// One physical copy in NAV-028 (LOC-031): only where it is (user, 2026-09-29).
export interface MapCopy {
  rackNo: string; // as written in NAV-028
  boxNo: string;
}

// One NAV-145 row whose "Action to be Taken" is Print or Available, with its map looked up in NAV-028.
export interface MapOrder {
  id: string; // production order + rug item
  productionOrderNo: string;
  quality: string;
  design: string;
  size: string;
  shape: string;
  groundColor: string;
  borderColor: string;
  mapItemNo: string;
  action: string; // "Print" or "Available", as written in NAV-145
  copies: MapCopy[]; // empty when the map has no usable copy in LOC-031
  assignedTo?: string; // sketcher name
  assignedAt?: string;
  pickedUpAt?: string;
}

export type MapAction =
  | { type: "assign"; id: string; sketcherName: string }
  | { type: "pickup"; id: string }
  | { type: "undoPickup"; id: string };

export interface MapsState {
  orders: MapOrder[];
  refreshedAt?: string;
  files?: { inventory: string; orders: string };
}
