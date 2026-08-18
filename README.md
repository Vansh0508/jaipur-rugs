# jaipur-rugs

Hub-first monorepo for Jaipur Rugs internal apps — see [`AGENTS.md`](./AGENTS.md) for the full execution playbook (tech stack, DB planning process, do's/don'ts) before touching this repo.

Planning artifacts (architecture rationale, ERDs) live in the sibling `DB Planning` folder until they're promoted into this repo.

## Status

Scaffold only. No apps have been added under `apps/` yet, and no DB migrations exist in `db/` — both are pending the DB planning process in `AGENTS.md` §3.1.

## Structure

- `apps/` — one Next.js app per deployable surface (Hub first). Empty for now.
- `packages/` — shared `ui-kit`, `charts`, `supabase-client`, `auth`, `config`. Stubbed.
- `db/` — ERDs + migrations, one subfolder per module. Empty for now.
