# Atlas

Unified order visibility: merchant, production, shipping, sales, and admin, all looking
at the same page (replaces the standalone `Track JR Orders` tool). Backed by the
`orders` DB module — see `db/orders/README.md` for the full plain-language schema and
`AGENTS.md`'s recorded overrides for the two shared-stack decisions this app made
(Clerk for merchant auth, react-bits-pattern motion accents in `packages/ui-kit`).

## Status (as of this build pass)

Code-complete for Phase 1 scope (build prompt Section 7) — schema, RLS, Edge Functions,
and this frontend are all written. **Not yet deployed or browser-verified**: the session
that wrote this had no live Supabase credentials (service-role key, CLI login) or a
runnable `pnpm install`, so none of the following has been exercised against a real
environment yet. Whoever picks this up next needs to:

1. Apply `db/orders/001`-`003` to the live project (`matnispbauvvlnbsuzxq` — verify
   still current per `AGENTS.md` Section 10) and run the security/performance advisors,
   same as every other module. Record the result in `db/MIGRATIONS.md`.
2. Regenerate `packages/supabase-client`'s types from the live schema and replace the
   hand-authored section flagged at the top of `types.ts`.
3. Deploy `supabase/functions/orders-sync`, `orders-update-stage`,
   `orders-set-shipping-detail`, `merchants-invite`, `merchants-link-clerk-account`.
   Set `ORDERS_SYNC_SECRET` (matching the Vault secret `db/orders/003_orders_sync_cron.sql`
   reads) and `CLERK_SECRET_KEY` as function environment variables.
4. Create a real Clerk application, set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` /
   `CLERK_SECRET_KEY` here, and — separately — add Clerk as a Supabase Third-Party Auth
   provider in the Dashboard (required for `private.can_view_order()`'s merchant branch
   to see anything at all; `merchants-link-clerk-account` itself doesn't need this step,
   it verifies independently).
5. `pnpm install` at the repo root and confirm `@clerk/nextjs` actually works against
   this repo's Next.js version (`^16.3.1`) — written against Clerk's documented App
   Router API, not confirmed live.
6. Watch the first real `orders-sync` run's duration/memory — the ERP feed was observed
   at ~120k rows / ~145MB; see that function's own comment for the fallback plan if a
   single Edge Function invocation can't fit it.
7. Seed real merchants via the "Merchants" admin page (or `merchants-invite` directly)
   using the list Heman's team already supplied, per the build prompt.
8. Browser-verify all three audiences (admin, a production/shipping/sales grant holder,
   a linked merchant) before sunsetting the old tool, per the migration checklist.

**Deliberately not done in this pass:** `packages/charts` (Bklit) integration for
TAT-trend/on-time-% line charts — `packages/charts` is still an empty stub (no real
Bklit dependency wired in yet, and its `package.json` peer-deps on React 18, which
predates this repo's move to React 19 elsewhere) and isn't a named Phase 1 deliverable
in the build prompt's actual scope list (Section 7) the way the order list/detail,
per-stage TAT, and Excel export are. The dashboard here uses simple count tiles and
per-stage totals instead. Populate `packages/charts` for real (and reconcile its React
version) when a trend chart is actually needed, rather than guessing at a config for a
library this pass couldn't install or run against.

## Structure

- Staff routes (`/login`, `/dashboard`, `/orders`, `/orders/[id]`, `/merchants`) use the
  same Supabase Auth pattern as every other app, via `packages/auth`.
- Merchant routes (`/merchant/login`, `/merchant/orders`, `/merchant/orders/[id]`) use
  Clerk — a deliberate, recorded exception to the shared Supabase-Auth-only pattern (see
  `AGENTS.md`). `proxy.ts` composes both auth systems in one file; see its comment.
- `lib/queries/orders.ts` / `lib/queries/merchants.ts` are the only place either audience
  reads from Postgres — both staff and merchant pages call the same functions with
  different (RLS-scoped) Supabase clients, so there's one query shape to keep correct.
