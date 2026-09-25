// db-management write endpoint for apps/hub's Team page "Bulk upload" action. Gated by the
// same `employees.write` permission as invite-employee/update-employee — a bulk upload is
// treated as N of those actions, not a separately-gated capability.
//
// The caller (BulkUploadEmployeesModal) has already parsed the uploaded spreadsheet and
// resolved department/manager/role names to ids client-side, against data it read straight
// from the DB — this function does not redo that name-resolution. What it DOES redo, and
// is the actual source of truth for, is: (a) the dedup lookup per row (never trusts the
// client's precomputed create/update classification, the same principle invite-employee
// already applies with its own server-side email-dedup re-check), and (b) the write itself.
//
// Rows are processed one at a time rather than as a single bulk insert/update — a bad row
// (a race against a concurrent edit, an unexpected constraint violation) fails only that
// row, not the whole batch. These lookup tables run "a few dozen rows at most" in practice
// (see apps/hub/components/settings/DependencyTable.tsx's own precedent), so a sequential
// loop needs no batching/streaming.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EmploymentType = "full_time" | "part_time" | "contract" | "intern" | "consultant";

interface BulkUploadEmployeeRow {
  fullName: string;
  email: string;
  /** Only meaningful (and only read) when `dedupKey` is `"employee_code"`. */
  employeeCode?: string;
  departmentId?: string | null;
  managerId?: string | null;
  primaryRoleId?: string | null;
  employmentType?: EmploymentType;
}

interface BulkUploadEmployeesBody {
  dedupKey: "email" | "employee_code";
  overwriteExisting: boolean;
  rows: BulkUploadEmployeeRow[];
}

interface RowResult {
  index: number;
  action: "created" | "updated" | "skipped" | "failed";
  employeeId?: string;
  employeeCode?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireEmployeePermission(
      supabaseAdmin,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      req,
      "employees.write",
    );

    const body = (await req.json()) as Partial<BulkUploadEmployeesBody>;
    const dedupKey = body.dedupKey === "employee_code" ? "employee_code" : "email";
    const overwriteExisting = body.overwriteExisting === true;
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (rows.length === 0) {
      return jsonResponse({ error: "rows is required and must be a non-empty array" }, 400);
    }

    const results: RowResult[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const fullName = row.fullName?.trim() ?? "";
      const email = row.email?.trim().toLowerCase() ?? "";
      const employeeCode = row.employeeCode?.trim() ?? "";

      if (!fullName && !email && !employeeCode) {
        results.push({ index, action: "failed", error: "row has no name, email, or employee code to act on" });
        continue;
      }

      // No field is unconditionally required here — a row identified purely by
      // employee_code, matching an existing employee, needs neither fullName nor email
      // (see the "not existing" branch below for where those actually become required).
      // A blank employeeCode falls through to the email lookup even in "match by
      // employee_code" mode — that's expected for a brand-new hire, who has no code yet.
      let existing: { id: string } | null = null;
      if (dedupKey === "employee_code" && employeeCode) {
        const { data, error: lookupError } = await supabaseAdmin
          .from("employees")
          .select("id")
          .eq("employee_code", employeeCode)
          .maybeSingle();
        if (lookupError) {
          results.push({ index, action: "failed", error: lookupError.message });
          continue;
        }
        existing = data;
      } else if (email) {
        const { data, error: lookupError } = await supabaseAdmin.from("employees").select("id").ilike("email", email).maybeSingle();
        if (lookupError) {
          results.push({ index, action: "failed", error: lookupError.message });
          continue;
        }
        existing = data;
      }

      if (!existing) {
        if (!fullName || !email) {
          results.push({ index, action: "failed", error: "fullName and email are required to create a new employee" });
          continue;
        }
        const { data: newEmployeeCode, error: codeError } = await supabaseAdmin.rpc("next_employee_code");
        if (codeError || !newEmployeeCode) {
          results.push({ index, action: "failed", error: codeError?.message ?? "failed to allocate employee_code" });
          continue;
        }
        const { data: created, error: insertError } = await supabaseAdmin
          .from("employees")
          .insert({
            employee_code: newEmployeeCode,
            full_name: fullName,
            email,
            department_id: row.departmentId ?? null,
            manager_id: row.managerId ?? null,
            primary_role_id: row.primaryRoleId ?? null,
            employment_type: row.employmentType ?? "full_time",
            status: "invited",
          })
          .select("id, employee_code")
          .single();
        if (insertError || !created) {
          results.push({ index, action: "failed", error: insertError?.message ?? "insert failed" });
          continue;
        }
        results.push({ index, action: "created", employeeId: created.id, employeeCode: created.employee_code });
        continue;
      }

      if (!overwriteExisting) {
        results.push({ index, action: "skipped", employeeId: existing.id });
        continue;
      }

      if (row.managerId === existing.id) {
        results.push({ index, action: "failed", error: "an employee cannot be their own manager" });
        continue;
      }

      // Deliberately the same field set as update-employee's own boundary: org-chart
      // fields only. full_name/email/employee_code/status are never touched here, even
      // though this row matched an existing employee — see this file's header comment.
      //
      // department_id/manager_id/primary_role_id are nullable columns, so a blank cell
      // resolves to `null` and is always sent — clearing the field is a legitimate,
      // visible-in-the-preview-report action. employment_type is NOT NULL (defaults to
      // 'full_time'), so a blank cell has no coherent "clear" meaning: it's only included
      // in the update when the row actually specified one, otherwise the employee's
      // existing employment_type is left untouched.
      const update: Record<string, unknown> = {
        department_id: row.departmentId ?? null,
        manager_id: row.managerId ?? null,
        primary_role_id: row.primaryRoleId ?? null,
      };
      if (row.employmentType) {
        update.employment_type = row.employmentType;
      }

      const { error: updateError } = await supabaseAdmin.from("employees").update(update).eq("id", existing.id);
      if (updateError) {
        results.push({ index, action: "failed", error: updateError.message });
        continue;
      }
      results.push({ index, action: "updated", employeeId: existing.id });
    }

    return jsonResponse({ results });
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
