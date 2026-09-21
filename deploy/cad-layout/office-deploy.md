# Deploying CAD Layout to the office server (192.168.0.18:3006)

Same box and same pattern as Atlas — see `deploy/atlas/office-deploy.md`, which this
follows deliberately rather than inventing a second deployment style. CAD Layout does not
go to Vercel: the PDF step shells out to LibreOffice, which a serverless function can't
host (PRD Section 4.4).

**Not yet deployed as of 2026-09-21.** Everything below except the two blocked steps was
verified live against the server on that date (SSH, versions, free port, disk); the blocked
steps are called out as such.

## Server facts (verified 2026-09-21, not assumed)

| | |
|---|---|
| SSH | `idmt@192.168.0.18` — key-based, works without a password |
| Checkout | `/home/idmt/apps/jaipur-rugs`, branch `main` |
| Runtime | node `v20.20.2`, pnpm `9.12.0`, pm2 `7.0.4` |
| Port 3006 | free (nothing listening) |
| Disk | 39 GB free of 98 GB |
| Also running | `atlas`, `daily-tracker`, `daily-tracker-react`, `sapl-api`, `sapl-frontend` — a busy shared box; don't restart anything you didn't deploy |
| LibreOffice | **not installed** |
| sudo | **requires a password** — so installing LibreOffice needs a human |

## Two things block a fully-working deploy

1. **`git push origin main`** — the server deploys by pulling, so the commit has to be on
   `main` first. (Commit `60e4d28` is ready locally but the push was refused by this
   session's permission policy.)
2. **LibreOffice** — without it there is no PDF export. The app degrades gracefully: PPTX
   still downloads and the UI says PDF is unavailable, so it's safe to go live without it,
   but DnD asked for both formats.

   ```bash
   sudo apt-get update
   sudo apt-get install -y libreoffice-impress fonts-crosextra-carlito fonts-liberation
   soffice --version   # confirm
   ```

   The fonts matter: the templates use Tw Cen MT, Microsoft JhengHei and Arial. Carlito and
   Liberation are the metric-compatible stand-ins. Compare one generated PDF against the
   PowerPoint-rendered one before telling DnD it's live — substitution can shift line
   breaks in the spec table.

## Deploy

```bash
ssh idmt@192.168.0.18
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"   # pm2/node aren't on a non-login PATH

cd ~/apps/jaipur-rugs
git pull
pnpm install --frozen-lockfile        # needed: this app is new to the lockfile

cd "apps/DND/CAD Layout"
```

Create `.env.local` here (gitignored, so it never arrives via `git pull`). Copy the Supabase
URL and anon key from `apps/atlas/.env.local` on this same server — same Supabase project,
and reusing them avoids a second place to rotate:

```ini
NEXT_PUBLIC_SUPABASE_URL=<same as apps/atlas/.env.local>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as apps/atlas/.env.local>
NEXT_PUBLIC_ROOT_DOMAIN=
NEXT_PUBLIC_COOKIE_SECURE=false
```

`NEXT_PUBLIC_COOKIE_SECURE=false` is **not optional here.** This server is plain HTTP, and
`next start` always reports `NODE_ENV=production`, so without it the session cookie is
marked Secure, the browser silently drops it, and login bounces back to `/login` forever —
the exact bug Atlas hit on 2026-09-02. Leave it unset for any HTTPS deployment.

```bash
pnpm build                            # PM2 does not build; this must run first
pm2 start ecosystem.config.cjs        # process name: cad-layout, port 3006
pm2 save                              # survive reboots
```

## Verify

```bash
pm2 list | grep cad-layout            # expect: online
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3006/login   # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3006/new     # expect 307 -> /login
pm2 logs cad-layout --lines 30 --nostream
```

Then from a browser on the LAN: `http://192.168.0.18:3006`, sign in with a Jaipur Rugs
employee account, and generate one layout end-to-end. **Confirm the login actually sticks**
(that it doesn't return you to `/login`) — that's the plain-HTTP cookie trap above.

## Updating later

```bash
ssh idmt@192.168.0.18
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd ~/apps/jaipur-rugs && git pull
cd "apps/DND/CAD Layout" && pnpm build && pm2 restart cad-layout
```

`pnpm install --frozen-lockfile` only when `package.json`/`pnpm-lock.yaml` changed.

## Notes

- **`samples/` is gitignored**, so the real customer decks and BMPs never reach this server.
  `templates/` (the two files the app fills at runtime) is committed and does arrive.
- **The `cad-layout` database module is not applied yet** (`db/cad-layout/001_...sql`, see
  `db/MIGRATIONS.md`). The tool works without it — generated decks live in a per-job temp
  folder under `CAD_LAYOUT_JOB_DIR` (default `/tmp/cad-layout`), swept after 24 h. Until the
  migration lands there is no saved history and `/admin` will show an error instead of the
  usage table.
- Generated jobs accumulate in that temp folder between sweeps; each is a few MB. Worth a
  glance at `du -sh /tmp/cad-layout` once real usage starts.
