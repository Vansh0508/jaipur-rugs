import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAtlasStaffAccess, type AtlasStaffAccess } from "./requireAtlasStaffAccess";

// RugLens's own access gate, layered on top of requireAtlasStaffAccess (still required
// first — being on this page at all still means "has some real reason to be in Atlas").
// Confirmed directly by Ayaan, 2026-09-10: RugLens should go to Sales and Back Ops.
//
// *** Corrected 2026-09-16, direct feedback ("not accessible to everyone?") — this
// originally only checked department_access_grants for sales/backops. Checked live: 0
// employees hold an actual "sales" department_access_grants row — that's not how real
// salespeople get into Atlas at all. The real, dominant path is self-service
// employee_salesperson_codes (19 people) and, for territory heads/B2B salespeople,
// merchant_customer_codes (9 people) — see requireAtlasStaffAccess.ts's own header
// comment for why those are first-class "reasons to be in Atlas" alongside a department
// grant. This gate never checked either, so in practice almost every real Sales person
// was blocked — only admins and the one person with an actual backops grant (Rahul
// Sharma) could get in. Now reuses staffAccess's own already-computed
// hasSalespersonCodeGrants/hasCustomerCodeGrants (requireAtlasStaffAccess already
// queries these — no new query needed here) instead of re-deriving "is this a Sales
// person" from a narrower, wrong signal.
//
// *** Known gap, STILL not resolved by this fix: this only gates the APP-LEVEL check.
// The actual ROW-LEVEL security is Postgres RLS (private.can_view_order() in
// db/orders/001_orders_core_schema.sql). Checked live, 2026-09-16: it grants
// salesperson-code/merchant-code holders visibility only into rows matching THEIR OWN
// code — fine for real customer orders, but stock/sample rows (the 5
// STOCK_CUSTOMER_CODES RugLens shows) aren't "assigned" to any salesperson the same
// way (confirmed: of 32,728 stock rows, only 3,081 have any salesperson_code at all,
// spanning just 3 codes) — so a salesperson/merchant-code holder who now passes THIS
// check would still see an empty RugLens table, silently, because RLS itself has
// nothing granting them blanket visibility into stock rows specifically. That needs its
// own RLS change (a stock-row-specific branch in can_view_order(), not scoped per
// salesperson/customer like the rest of the table) — a real production migration,
// deliberately NOT applied here without Ayaan's explicit go-ahead first, same posture
// as the still-pending rug_lens_facets() performance migration (see
// lib/queries/rugLens.ts's incident note). ***
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

  return {
    ...staffAccess,
    hasRugLensAccess:
      staffAccess.isAdmin || hasDepartmentGrant || staffAccess.hasSalespersonCodeGrants || staffAccess.hasCustomerCodeGrants,
  };
}
