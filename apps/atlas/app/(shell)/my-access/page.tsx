import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listMySalespersonCodes } from "@/lib/queries/merchants";
import { AddSalespersonCodesForm } from "@/components/AddSalespersonCodesForm";
import { JoinDepartmentForm } from "@/components/JoinDepartmentForm";

// Self-service home for the things an admin can't do for you: telling Atlas which ERP
// sales code(s) are actually yours (no name<->code mapping exists to derive this from —
// see db/orders/010_salesperson_codes_self_service.sql), or joining Management/
// Production. Everyone gets this page, not just people missing access — most people
// will just see an empty state, which is fine.
export default async function MyAccessPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const params = await searchParams;
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

      {params.welcome ? (
        // Landed here automatically (proxy.ts / requireAtlasStaffAccess.ts) because this
        // account is signed in and active but has no department, sales code, or customer
        // code yet — typically someone who just signed up and left the sales-code field
        // blank, or picked no department at all. Added 2026-09-10 alongside the fix that
        // sends people here instead of a silent dead end — see proxy.ts's comment for
        // what this replaced.
        <p className="rounded-lg border-2 border-accent/30 bg-accent/5 px-4 py-3 text-sm text-foreground">
          Your account is set up — you just don&apos;t have anything to see yet. Add your sales code, or join a
          department, below. It takes effect immediately, no admin approval needed.
        </p>
      ) : null}

      <AddSalespersonCodesForm />

      <JoinDepartmentForm />

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
