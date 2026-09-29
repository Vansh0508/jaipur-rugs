// Maps tab: which pending orders have their map sitting in the MAP Library (NAV-028, LOC-031),
// and where every copy is. The manager assigns an order to a sketcher, who collects it and marks it picked up.

// One physical copy in NAV-028, with the same details the MAP Library sheet (Test.xlsx) showed.
export interface MapCopy {
  serialNo: string;
  rackNo: string; // as written in NAV-028
  boxNo: string;
  mapRemarks: string;
  quality: string;
  design: string;
  groundColor: string;
  borderColor: string;
  size: string;
  shape: string;
}

export interface MapOrder {
  id: string; // production order + rug item
  rugItemNo: string;
  productionOrderNo: string;
  customerNo: string;
  orderPriority: string;
  pendingDays: string;
  mapItemNo: string;
  mapDescription: string;
  followUpPerson: string;
  required: number; // "Req": pending orders needing this map. "Ava" is copies.length.
  copies: MapCopy[];
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
