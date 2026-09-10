import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAtlasStaffAccess, type AtlasStaffAccess } from "./requireAtlasStaffAccess";

// RugLens's own access gate, layered on top of requireAtlasStaffAccess (still required
// first — being on this page at all still means "has some real reason to be in Atlas").
// Confirmed directly by Ayaan, 2026-09-10: RugLens should go to Sales and Back Ops.
// "Sales" is one of the existing ATLAS_DEPARTMENT_CODES. "Back Ops" is NOT — there's no
// `backops` row in `departments` yet (Ayaan: "will be added soon", a separate piece of
// work). Checked directly here rather than waiting on that: the moment a `backops`
// department + department_access_grants rows exist, this starts working with no further
// code change. Until then the `.in("departments.code", [...])` below simply matches zero
// rows for "backops" — not an error, just nobody has it yet.
//
// *** Known gap, flag to Ayaan/whoever adds Back Ops: this only gates the APP-LEVEL
// check below. The actual ROW-LEVEL security is Postgres RLS
// (private.can_view_order() in db/orders/001_orders_core_schema.sql), which today only
// recognizes production/shipping/sales/management department grants — "backops" is not
// in it. A Back Ops employee could pass this check once granted the department but
// still see zero rows, silently, because RLS itself doesn't know "backops" yet. That
// needs its own small migration (regenerate types, rerun advisors, per AGENTS.md
// section 3.1) alongside whatever adds the Back Ops department for real — not done here since
// that's explicitly a separate, not-yet-ready piece of work. ***
const RUG_LENS_DEPARTMENT_CODES = ["sales", "backops"] as const;

export interface RugLensAccess extends AtlasStaffAccess {
  /** Whether this employee should actually see RugLens's content — false renders an
   * inline "ask for access" notice rather than redirecting, since /my-access has no
   * self-service option for this yet either (same reasoning as its own dead-end fix,
   * see requireAtlasStaffAccess.ts's header comment on the 2026-09-10 Hub-redirect fix). */
  hasRugLensAccess: boolean;
}

export async function requireRugLensAccess(supabase: SupabaseClient): Promise<RugLensAccess> {
  const staffAccess = await requireAtlasStaffAccess(supabase);

  const { data: grants } = await supabase
    .from("department_access_grants")
    .select("departments!inner(code)")
    .eq("employee_id", staffAccess.employeeId)
    .in("departments.code", RUG_LENS_DEPARTMENT_CODES);
  const hasDepartmentGrant = Boolean(grants?.length);

  return { ...staffAccess, hasRugLensAccess: staffAccess.isAdmin || hasDepartmentGrant };
}
