# Local-build deploy for Atlas (VPS)

## What this is for

The VPS deploy used to work by pulling code onto the Hostinger VPS and running
`docker compose build` there — which makes the VPS itself compile the whole Next.js app.
That compile step is CPU-heavy, and Hostinger's plan has limited/shared CPU, so a deploy
could throttle the box for hours (real, observed: 6-7 hours, dragging down the `planit`
and `n8n` containers on the same server too, not just Atlas).

This folder builds the image on your own machine instead, and only ships the VPS a
finished, ready-to-run image. The VPS's job shrinks to "unpack it and restart the
container" — no compiling there at all.

## One-time setup

1. Docker Desktop installed and running on this machine (Windows: needs WSL2 —
   `wsl --install` as admin, reboot, then install Docker Desktop).
2. SSH access to the VPS already working from this machine (`ssh root@72.62.228.150`) —
   same access already used for manual deploys/checks, nothing new to set up here.

## Files here

- **`Dockerfile`** — exact copy of `/docker/atlas/Dockerfile` on the VPS. Keep the two in
  sync if either changes.
- **`deploy-atlas.bat`** — the whole flow: build → save → send → load → restart.
- **`../../apps/atlas/.env.production.local`** (gitignored) — the production
  `NEXT_PUBLIC_*` build values this script bakes into the image. Matches
  `/docker/atlas/.env` on the VPS. Update both together if the Supabase project, root
  domain, or hub URL ever change.

## Usage

Double-click `deploy-atlas.bat`, or run it from a terminal:

```
deploy\atlas\deploy-atlas.bat
```

It builds, transfers, and restarts Atlas on the VPS with no further input. Takes longer
than a plain `git pull` on the VPS used to (the image file itself has to travel over the
network), but the VPS's CPU stays free the whole time — nothing to compile there.

If it fails partway, nothing is switched over: the old container keeps running on the
VPS until a deploy actually completes successfully.

## What this does NOT change

- The VPS still has its own copy of the Dockerfile/docker-compose.yml/.env at
  `/docker/atlas/` — this script assumes they match what's here and doesn't touch them.
  If you change the Dockerfile or the production env values, update both places.
- This only covers the Atlas web app's own deploy. It doesn't touch
  `orders-sync.mjs`/`orders-delay-alerts.mjs`, which run on the office server (they need
  the office LAN's route to the NAV database — the VPS has no path to it at all).
