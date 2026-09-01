import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listSalespeopleWithCustomerCodes } from "@/lib/queries/merchants";
import { InviteMerchantForm } from "@/components/InviteMerchantForm";

// Nav only shows this to admins (SidebarNav), but RLS is the real gate — a non-admin
// landing here directly just sees an empty list, not another salesperson's data.
export default async function MerchantsPage() {
  const supabase = await getServerSupabaseClient();
  const salespeople = await listSalespeopleWithCustomerCodes(supabase);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Merchants</h1>
        <p className="text-sm text-muted">
          Territory heads/B2B salespeople and which ERP customer codes each one can see. Every one is a normal Jaipur
          Rugs staff account — no separate sign-up.
        </p>
      </div>

      <InviteMerchantForm />

      <div className="overflow-x-auto rounded-xl border-2 border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-border text-xs uppercase text-muted">
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Customer No.(s)</th>
            </tr>
          </thead>
          <tbody>
            {salespeople.map((s) => (
              <tr key={s.employeeId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{s.fullName}</div>
                  <div className="text-xs text-muted">{s.email}</div>
                </td>
                <td className="px-4 py-3">{s.customerNos.join(", ")}</td>
              </tr>
            ))}
            {!salespeople.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted" colSpan={2}>
                  No customer-code grants yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
