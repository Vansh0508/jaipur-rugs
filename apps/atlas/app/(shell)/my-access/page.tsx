import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listMySalespersonCodes, listMyCustomerCodes } from "@/lib/queries/merchants";
import { listPendingColumnRequests, listApprovedColumnRequests } from "@/lib/queries/orders";
import { requireAtlasStaffAccess } from "@/lib/auth/requireAtlasStaffAccess";
import { AddSalespersonCodesForm } from "@/components/AddSalespersonCodesForm";
import { AddCustomerCodesForm } from "@/components/AddCustomerCodesForm";
import { JoinDepartmentForm } from "@/components/JoinDepartmentForm";
import { RequestColumnForm } from "@/components/RequestColumnForm";
import { ColumnRequestAdminList } from "@/components/ColumnRequestAdminList";

// Self-service home for the things an admin can't do for you: telling Atlas which ERP
// sales code(s) or customer code(s) are actually yours (no name<->code mapping exists to
// derive either from the ERP feed — see db/orders/010_salesperson_codes_self_service.sql
// and db/orders/017_backops_department_self_service.sql), or joining Management/
// Production/Back Ops. Everyone gets this page, not just people missing access — most
// people will just see an empty state, which is fine.
export default async function MyAccessPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const params = await searchParams;
  const supabase = await getServerSupabaseClient();
  // allowUnauthorized: true — same reasoning as ShellLayout's own call (this page must
  // stay reachable by someone with no access yet); only isAdmin is used here, to gate
  // the "Pending column requests" section below.
  const [access, codes, customerCodes] = await Promise.all([
    requireAtlasStaffAccess(supabase, { allowUnauthorized: true }),
    listMySalespersonCodes(supabase),
    listMyCustomerCodes(supabase),
  ]);
  const [pendingColumnRequests, approvedColumnRequests] = access.isAdmin
    ? await Promise.all([listPendingColumnRequests(supabase), listApprovedColumnRequests(supabase)])
    : [[], []];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My access</h1>
        <p className="text-sm text-muted">
          Add your own ERP sales code(s) and/or customer code(s) here so Orders shows the ones that are actually
          yours.
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

      <AddCustomerCodesForm />

      <JoinDepartmentForm />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Your current sales codes</h2>
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

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Your current customer codes</h2>
        {customerCodes.length ? (
          <ul className="flex flex-wrap gap-2">
            {customerCodes.map((code) => (
              <li key={code} className="rounded-lg border-2 border-border px-3 py-1.5 text-sm text-foreground">
                {code}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No customer codes added yet.</p>
        )}
      </div>

      <RequestColumnForm />

      {access.isAdmin ? (
        // Admin-only (orders.read.all — same permission ShellLayout's sidebar already
        // gates on). Real Approve/Decline buttons as of 2026-09-14 (ColumnRequestAdminList)
        // — approving records the decision immediately but does NOT make the field live
        // on its own; actually adding it is still a real migration + an
        // orders-sync.mjs update + a deploy, not something a click can safely automate
        // for a live, every-30-minute ERP sync — see db/orders/022_column_requests.sql's
        // header for the full reasoning.
        <>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Pending column requests</h2>
            <ColumnRequestAdminList requests={pendingColumnRequests} />
          </div>

          {approvedColumnRequests.length ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Approved, not yet built</h2>
              <p className="mb-3 text-sm text-muted">
                Decided on — still needs the actual schema/sync-script work before it shows up as a column.
              </p>
              <ul className="flex flex-col gap-2">
                {approvedColumnRequests.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between gap-4 rounded-lg border-2 border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-foreground">{req.nav_field_name}</span>
                      <span className="ml-2 text-xs text-muted">
                        requested by {req.requester_name ?? "unknown"} · {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
