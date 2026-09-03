import type { SupabaseClient } from "@supabase/supabase-js";

// Plain SupabaseClient, not SupabaseClient<Database> — see lib/queries/orders.ts's comment.
//
// "Merchant" here means a territory head/B2B salesperson scoped to specific ERP
// customer codes (Ayaan's correction, 2026-09-01) — not an external customer. Every one
// is a normal employees row; this just groups merchant_customer_codes by employee for
// the admin management page. The old separate `merchants` table (Clerk-linked) is gone.

export interface SalespersonWithCodes {
  employeeId: string;
  fullName: string;
  email: string;
  customerNos: string[];
}

/** Admin-only in practice — RLS's merchant_customer_codes_select only returns every row
 * to an orders.read.all holder; anyone else only sees their own. */
export async function listSalespeopleWithCustomerCodes(supabase: SupabaseClient): Promise<SalespersonWithCodes[]> {
  const { data, error } = await supabase
    .from("merchant_customer_codes")
    .select("customer_no, employees!inner(id, full_name, email)")
    .order("customer_no", { ascending: true });
  if (error) throw error;

  const byEmployee = new Map<string, SalespersonWithCodes>();
  for (const row of data ?? []) {
    const emp = row.employees as unknown as { id: string; full_name: string; email: string };
    let entry = byEmployee.get(emp.id);
    if (!entry) {
      entry = { employeeId: emp.id, fullName: emp.full_name, email: emp.email, customerNos: [] };
      byEmployee.set(emp.id, entry);
    }
    entry.customerNos.push(row.customer_no as string);
  }
  return [...byEmployee.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** The caller's own salesperson codes (self-service, db/orders/010) — RLS's
 * employee_salesperson_codes_select already restricts a non-admin to their own rows, so
 * this doesn't need to filter by employee_id itself. Used by /my-access. */
export async function listMySalespersonCodes(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("employee_salesperson_codes")
    .select("salesperson_code")
    .order("salesperson_code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.salesperson_code as string);
}
