import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listMySalespersonCodes } from "@/lib/queries/merchants";
import { AddSalespersonCodesForm } from "@/components/AddSalespersonCodesForm";

// Self-service home for the one thing an admin can't do for you: telling Atlas which
// ERP salesperson code(s) are actually yours (no name<->code mapping exists to derive
// this from — see db/orders/010_salesperson_codes_self_service.sql). Everyone gets this
// page, not just salespeople — most people will just see an empty list, which is fine.
export default async function MyAccessPage() {
  const supabase = await getServerSupabaseClient();
  const codes = await listMySalespersonCodes(supabase);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My access</h1>
        <p className="text-sm text-muted">
          If you&apos;re a salesperson, add your own ERP sales code(s) here so Orders shows the ones under your name.
        </p>
      </div>

      <AddSalespersonCodesForm />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Your current codes</h2>
        {codes.length ? (
          <ul className="flex flex-wrap gap-2">
            {codes.map((code) => (
              <li key={code} className="rounded-lg border-2 border-border px-3 py-1.5 text-sm text-foreground">
                {code}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No sales codes added yet.</p>
        )}
      </div>
    </div>
  );
}
