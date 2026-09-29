import type { SupabaseClient } from "@supabase/supabase-js";

async function invoke<T>(supabase: SupabaseClient, name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body as Record<string, unknown> });
  if (error || !data) {
    const response = (error as { context?: Response } | null)?.context;
    if (response) {
      try { const parsed = await response.json(); throw new Error(parsed.error || error?.message); }
      catch (parsedError) { if (parsedError instanceof Error && parsedError.message !== "Unexpected end of JSON input") throw parsedError; }
    }
    throw error ?? new Error(`${name} returned no data`);
  }
  return data;
}

// Mirrors db/sketch-challan/003 (revised 2026-09-28). Field keys are the app's camelCase form fields
// (FIELD_LABELS in apps/sketch-challan/lib/domain/types.ts); sketchers are employee ids.
export interface SketchChallanCommandResult { challanId: string; taskId?: string | null; requestId?: string | null }
export type SketchChallanPriority = "urgent" | "high" | "normal" | "low";
export type SketchChallanTaskStatus = "assigned" | "in_progress" | "blocked" | "clarification_requested" | "submitted" | "completed";
export type SketchChallanFields = Record<string, string | number>;

export interface SketchChallanExcelRow {
  productionOrderNo: string;
  /** Only the fields to write: filled report cells, minus manager-owned fields already set. */
  fields: SketchChallanFields;
  /** Every field the report supplied, stored so the next live refresh knows what it may overwrite. */
  excelFields?: string[];
  /** The raw report row (report name + columns), kept for audit. */
  source?: Record<string, unknown>;
  /** History line for a changed challan, e.g. "Live Excel changed Design: A → B." */
  message?: string;
}

/** droppedPos: production orders no longer in any report; unallotted ones are cancelled (allotted ones stay). */
export function refreshSketchChallansFromExcel(supabase: SupabaseClient, rows: SketchChallanExcelRow[], droppedPos: string[] = []) {
  return invoke<{ created: number; updated: number; cancelled: number }>(supabase, "sketch-challan-create", { rows, droppedPos });
}

/** Manager edit before allotment. */
export function updateSketchChallan(supabase: SupabaseClient, input: { challanId: string; changes: SketchChallanFields; message?: string }) {
  return invoke<SketchChallanCommandResult>(supabase, "sketch-challan-update", { action: "update", ...input });
}

/** The current part holder's remark. */
export function setSketcherRemark(supabase: SupabaseClient, input: { challanId: string; sketcherRemark: string }) {
  return invoke<SketchChallanCommandResult>(supabase, "sketch-challan-update", { action: "remark", ...input });
}

export interface SketchChallanHandover { taskId: string; sketcherId: string; effectiveOn: string; reason: string; excludedDates: string[] }

/** Manager asks Admin to change an allotted challan; `changes` may be empty (reason-only, or a handover). */
export function requestSketchChallanChange(
  supabase: SupabaseClient,
  input: { challanId: string; reason: string; changes: SketchChallanFields; handover?: SketchChallanHandover },
) {
  return invoke<SketchChallanCommandResult>(supabase, "sketch-challan-update", { action: "request_update", ...input });
}

export function reviewSketchChallanChange(
  supabase: SupabaseClient,
  input: { challanId: string; requestId: string; approved: boolean; note?: string },
) {
  return invoke<SketchChallanCommandResult>(supabase, "sketch-challan-update", { action: "review_update", ...input });
}

export function setSketchChallanStatus(
  supabase: SupabaseClient,
  input: { challanId: string; status: "active" | "on_hold" | "completed" | "cancelled"; reason?: string; dueDateOverride?: string },
) {
  return invoke<SketchChallanCommandResult>(supabase, "sketch-challan-set-status", input);
}

export type SketchChallanTaskCommand =
  | { action: "task_create"; challanId: string; parts: { sketcherId: string; assignedPart: string; title?: string }[] }
  | { action: "task_status"; challanId: string; taskId: string; status: "in_progress" | "submitted" }
  | { action: "task_review"; challanId: string; taskId: string; approved: boolean; note?: string }
  | ({ action: "task_transfer"; challanId: string } & SketchChallanHandover);

export function manageSketchChallanTask(supabase: SupabaseClient, input: SketchChallanTaskCommand) {
  return invoke<SketchChallanCommandResult>(supabase, "sketch-challan-task", input);
}
