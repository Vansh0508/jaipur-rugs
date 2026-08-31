import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listMerchantsWithCodes } from "@/lib/queries/merchants";
import { InviteMerchantForm } from "@/components/InviteMerchantForm";

// Nav only shows this to admins (SidebarNav), but RLS is the real gate — a non-admin
// landing here directly just sees an empty list, not another merchant's data.
export default async function MerchantsPage() {
  const supabase = await getServerSupabaseClient();
  const merchants = await listMerchantsWithCodes(supabase);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Merchants</h1>
        <p className="text-sm text-muted">Who can see which ERP customer codes in the merchant self-service view.</p>
      </div>

      <InviteMerchantForm />

      <div className="overflow-x-auto rounded-xl border-2 border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-border text-xs uppercase text-muted">
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium">Customer No.(s)</th>
              <th className="px-4 py-3 font-medium">Account status</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{m.displayName}</div>
                  <div className="text-xs text-muted">{m.primaryContactEmail}</div>
                </td>
                <td className="px-4 py-3">{m.customerNos.join(", ")}</td>
                <td className="px-4 py-3">{m.linked ? "Signed in" : "Not yet signed in"}</td>
              </tr>
            ))}
            {!merchants.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted" colSpan={3}>
                  No merchants added yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
