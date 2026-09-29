import type { SketchChallan } from "@/lib/domain/types";

const SELECT = "*, sketch_challan_items(*), sketch_challan_tasks(*, employees!sketch_challan_tasks_current_sketcher_id_fkey(full_name), sketch_challan_task_assignments(*, employees!sketch_challan_task_assignments_sketcher_id_fkey(full_name))), sketch_challan_change_requests(*), sketch_challan_activity(id,message,created_at)";
const PAGE = 500;

const byText = (key: string, dir = 1) => (a: any, b: any) => dir * String(a[key] ?? "").localeCompare(String(b[key] ?? ""));

// Column names follow db/sketch-challan/001 (revised 2026-09-28).
export async function listSketchChallans(supabase: any): Promise<SketchChallan[]> {
  // Supabase stops a select at 1000 rows by default, so page through rather than silently losing the rest.
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("sketch_challans").select(SELECT)
      .order("created_at", { ascending: false }).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((row: any) => {
    const item = (row.sketch_challan_items ?? []).find((line: any) => line.line_no === 1) ?? row.sketch_challan_items?.[0] ?? {};
    return {
      id: row.id, productionOrderNo: row.production_order_no, mapNo: row.map_no || undefined,
      excelFields: row.excel_fields ?? [], challanDate: row.challan_date ?? "",
      draftsman: row.draftsman, sketchCategory: row.sketch_category, sizeType: row.size_type,
      developer: row.developer, orderCount: row.order_count, design: row.design, ground: row.ground,
      border: row.border, matchingCode: row.matching_code, substituteDesign: row.substitute_design ?? "",
      quality: item.quality ?? "", shape: item.shape ?? "",
      mapWidthFt: Number(item.map_width_ft ?? 0), mapLengthFt: Number(item.map_length_ft ?? 0),
      orderSize: row.order_size || undefined, mapSizeNote: row.map_size_note || undefined,
      areaSqFt: Number(item.area_sq_ft ?? 0), quantity: Number(item.quantity ?? 1), description: row.description,
      managerRemark1: row.design_remarks ?? "",
      managerRemark2: row.substitute_remarks ?? "",
      sketcherRemark: row.sketcher_remark ?? "",
      dueDate: row.due_date ?? "", status: row.status, priority: row.priority,
      createdAt: row.created_at,
      tasks: [...(row.sketch_challan_tasks ?? [])].sort(byText("assigned_at")).map((task: any) => ({
        id: task.id, title: task.title, assignedPart: task.assigned_part,
        sketcherName: task.employees?.full_name ?? "Assigned Sketcher", status: task.status,
        blockedReason: task.blocked_reason ?? undefined,
        // Ordered by the assignment timestamp, not the date: a same-day handover must list the closed row first.
        assignments: [...(task.sketch_challan_task_assignments ?? [])].sort(byText("assigned_at")).map((assignment: any) => ({
          id: assignment.id,
          sketcherName: assignment.employees?.full_name ?? "Sketcher",
          assignedOn: assignment.assigned_on,
          startedOn: assignment.work_started_on ?? undefined,
          endedOn: assignment.work_ended_on ?? undefined,
          excludedDates: assignment.excluded_work_dates ?? [],
          transferReason: assignment.transfer_reason ?? undefined,
        })),
      })),
      // A requested handover is stored with the sketcher's employee id; showing it needs the name lookup that the
      // go-live wiring adds (README), so it is left out of this read-only view.
      changeRequests: [...(row.sketch_challan_change_requests ?? [])].sort(byText("requested_at", -1)).map((request: any) => ({
        id: request.id, requestedAt: request.requested_at, changes: request.proposed_changes,
        reason: request.reason, status: request.status, reviewedAt: request.reviewed_at ?? undefined,
        reviewNote: request.review_note ?? undefined,
      })),
      activity: [...(row.sketch_challan_activity ?? [])].sort(byText("created_at", -1))
        .map((activity: any) => ({ id: activity.id, message: activity.message, at: activity.created_at })),
    } as SketchChallan;
  });
}
