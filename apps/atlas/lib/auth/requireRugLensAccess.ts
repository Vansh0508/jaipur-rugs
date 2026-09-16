import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAtlasStaffAccess, type AtlasStaffAccess } from "./requireAtlasStaffAccess";

// RugLens's own access gate, layered on top of requireAtlasStaffAccess (still required
// first — being on this page at all still means "has some real reason to be in Atlas").
//
// History: originally scoped to Sales/Back Ops only (confirmed directly by Ayaan,
// 2026-09-10), via a department_access_grants check for sales/backops specifically.
// Corrected once already, 2026-09-16 ("not accessible to everyone?"): checked live, 0
// employees held an actual "sales" department_access_grants row — that was never how
// real salespeople get into Atlas (the real, dominant path is self-service
// employee_salesperson_codes / merchant_customer_codes — see
// requireAtlasStaffAccess.ts's own header comment), so in practice almost every real
// Sales person was blocked.
//
// Widened again the same day, direct instruction: "give access for rug lens to
// everyone." Simplified to match — anyone who already has general Atlas staff access
// (requireAtlasStaffAccess, called below, already redirects to /my-access if there's no
// real reason to be in Atlas at all — any department, a salesperson code, or a merchant
// customer code) also gets RugLens. No separate department/code check needed anymore;
// staffAccess having returned at all already means "yes."
//
// Row-level security matches this now too — see db/orders/030_ruglens_stock_visibility_
// for_everyone.sql (applied live, 2026-09-16): private.can_view_order() grants
// visibility into RugLens's stock/sample rows to anyone holding ANY Atlas department
// grant, any salesperson code, or any merchant customer code — not just Sales/Back Ops,
// and not scoped to a specific matching code the way real customer orders still are.
// Confirmed live before this migration: of 32,728 stock rows, only 3,081 had any
// salesperson_code at all (spanning 3 codes) — so without this RLS change, passing this
// app-level check alone would have left everyone else looking at an empty table.
export interface RugLensAccess extends AtlasStaffAccess {
  /** Always true once staffAccess itself is returned — kept as its own field (rather
   * than inlining `true` at call sites) so a future narrowing, if one's ever needed
   * again, has one place to change. */
  hasRugLensAccess: boolean;
}

export async function requireRugLensAccess(supabase: SupabaseClient): Promise<RugLensAccess> {
  const staffAccess = await requireAtlasStaffAccess(supabase);
  return { ...staffAccess, hasRugLensAccess: true };
}
