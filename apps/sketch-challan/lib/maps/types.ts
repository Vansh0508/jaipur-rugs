// Maps screen: NAV-145 orders to Print or with a map Available, and where each map copy is in the MAP Library
// (NAV-028, LOC-031). Admin and the rack management login only. Rack management ticks the copy it pulls for an order
// (29 Sep meeting); that copy then leaves every other order of the same map.

// One physical copy in NAV-028 (LOC-031). The serial no. is its id: kept, not shown.
export interface MapCopy {
  serialNo: string;
  rackNo: string; // as written in NAV-028
  boxNo: string;
}

// One NAV-145 row whose "Action to be Taken" is Print or Available, with its map looked up in NAV-028.
export interface MapOrder {
  id: string; // production order + rug item
  productionOrderNo: string;
  rugItemNo: string;
  quality: string;
  design: string;
  size: string;
  shape: string;
  groundColor: string;
  borderColor: string;
  mapItemNo: string;
  action: string; // "Print" or "Available", as written in NAV-145
  copies: MapCopy[]; // every usable copy of this map in LOC-031; empty when none
}

// A copy rack management ticked for an order. Kept across refreshes (they only replace the order list).
export interface ChosenCopy {
  orderId: string;
  productionOrderNo: string;
  mapItemNo: string;
  serialNo: string;
  rackNo: string;
  boxNo: string;
  at: string;
}

export type MapAction =
  | { type: "choose"; orderId: string; serialNo: string }
  | { type: "unchoose"; orderId: string };

export interface MapsState {
  orders: MapOrder[];
  chosen?: ChosenCopy[];
  refreshedAt?: string;
  files?: { inventory: string; orders: string };
}
