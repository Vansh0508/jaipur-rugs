import type { ChallanPriority, ChallanStatus } from "./challans";

export type TaskStatus = "assigned" | "in_progress" | "blocked" | "clarification_requested" | "submitted" | "completed";

export interface SketchTask {
  id: string;
  title: string;
  assignedPart: string;
  sketcherName: string;
  status: TaskStatus;
  blockedReason?: string;
  assignments?: SketchAssignment[];
}

export interface SketchAssignment {
  id: string;
  sketcherName: string;
  assignedOn: string;
  startedOn?: string;
  endedOn?: string;
  excludedDates?: string[];
  transferReason?: string;
}

export interface HandoverRequest {
  taskId: string;
  sketcherName: string;
  effectiveOn: string;
  reason: string;
  excludedDates: string[];
}

export interface ChallanChangeRequest {
  id: string;
  requestedAt: string;
  changes: ChallanDetailsPatch;
  reason: string;
  status: "pending" | "approved" | "rejected";
  handover?: HandoverRequest;
  reviewedAt?: string;
  reviewNote?: string;
}

export type ChallanDetailsPatch = Partial<Pick<SketchChallan,
  "challanDate" | "draftsman" | "sketchCategory" | "sizeType" | "developer" |
  "orderCount" | "design" | "ground" | "border" | "matchingCode" | "substituteDesign" |
  "quality" | "shape" | "mapWidthFt" | "mapLengthFt" | "areaSqFt" |
  "quantity" | "description" | "managerRemark1" | "managerRemark2" | "sketcherRemark" |
  "dueDate" | "priority"
>>;

// Every editable challan field, named as on the paper form. The server accepts only these keys (lib/domain/actions.ts).
export const FIELD_LABELS: Record<keyof ChallanDetailsPatch, string> = {
  challanDate: "Challan Date", draftsman: "DraftsMan", sketchCategory: "Sketch Category", sizeType: "Type Of Size",
  developer: "Developer", orderCount: "Order Count", design: "Design", ground: "Ground", border: "Border",
  matchingCode: "Matching Code", substituteDesign: "Substitute Design", quality: "Quality", shape: "Shape",
  mapWidthFt: "Map Width", mapLengthFt: "Map Length", areaSqFt: "Area", quantity: "Quantity",
  description: "Description", managerRemark1: "Design Remarks", managerRemark2: "Substitute Remarks",
  sketcherRemark: "Sketcher Remark", dueDate: "Due Date", priority: "Priority",
};

export interface SketchChallan {
  id: string;
  productionOrderNo: string;
  mapNo?: string;
  /** Fields the last Excel refresh supplied; only these are overwritten by the next live refresh. */
  excelFields?: (keyof SketchChallan)[];
  challanDate: string;
  draftsman: string;
  sketchCategory: string;
  sizeType: string;
  developer: string;
  orderCount: number;
  design: string;
  ground: string;
  border: string;
  matchingCode: string;
  substituteDesign?: string;
  quality: string;
  shape: string;
  mapWidthFt: number;
  mapLengthFt: number;
  orderSize?: string;
  mapSizeNote?: string;
  areaSqFt: number;
  quantity: number;
  description: string;
  managerRemark1: string;
  managerRemark2: string;
  sketcherRemark: string;
  dueDate: string;
  status: ChallanStatus;
  priority: ChallanPriority;
  createdAt: string;
  tasks: SketchTask[];
  activity: { id: string; message: string; at: string }[];
  changeRequests?: ChallanChangeRequest[];
}

export const SKETCH_CATEGORIES = [
  "Copy Paste",
  "Copy Paste Setting",
  "Side Setting Repeat",
  "Side Setting Develop",
  "Scale Easy",
  "Scale Medium",
  "Scale Hard",
  "Border Copy paste, Bicha copy paste setting",
  "Border setting, Bicha setting",
  "Border Copy paste, Bicha Scale",
  "Border Scale, Bicha Copy paste",
  "Design + Texcure+ Colouring",
  "Length Adjustment",
  "Wirth Adjustment",
  "Unfinishing",
  "Layout accordingly Swatch file create",
] as const;
