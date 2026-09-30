import type { SketchChallan } from "./domain/types";
import { challanStatusLabel } from "./domain/assignments";

export async function exportChallansToExcel(rows: SketchChallan[]) {
  const XLSX = await import("xlsx");
  const data = rows.map((row) => ({
    "Production Order No.": row.productionOrderNo,
    "Map No": row.mapNo ?? "",
    "Challan Date": row.challanDate,
    Draftsman: row.draftsman,
    "Sketch Category": row.sketchCategory,
    Design: row.design,
    Ground: row.ground,
    Border: row.border,
    "Matching Code": row.matchingCode,
    Quality: row.quality,
    Shape: row.shape,
    "Map Width (ft)": row.mapWidthFt,
    "Map Length (ft)": row.mapLengthFt,
    "Area (sq ft)": row.areaSqFt,
    Quantity: row.quantity,
    Status: challanStatusLabel(row),
    Priority: row.priority,
    "Due Date": row.dueDate,
    Sketchers: row.tasks.map((task) => task.sketcherName).join(", "),
    "Assigned Parts": row.tasks.map((task) => `${task.sketcherName}: ${task.assignedPart}`).join(" | "),
    "Manager Remark 1": row.managerRemark1,
    "Manager Remark 2": row.managerRemark2,
    "Sketcher Remark": row.sketcherRemark,
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sketch Challans");
  XLSX.writeFile(book, `sketch-challans-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
