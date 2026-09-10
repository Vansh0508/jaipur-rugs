# Deploying Atlas to the office server (192.168.0.18:3001)

Confirmed live, 2026-09-10 (`pm2 show atlas`, `git log`, `.next/BUILD_ID` timestamp) —
not guessed. This is the deployment RugLens's photo feature actually depends on (the VPS
can't reach the J-Vault share — see `apps/atlas/app/api/rug-lens/photo/route.ts`'s
comment), so get this one right before testing that feature.

## How it actually runs

- **Process manager**: PM2, process name `atlas` (id 3 in `pm2 list`).
- **What PM2 runs**: `next start -p 3001` — a plain, already-built Next.js server. PM2
  does NOT build the app; something has to run the build separately before restarting.
- **Working directory**: `/home/idmt/apps/jaipur-rugs/apps/atlas` — inside a real git
  checkout of this same repo at `/home/idmt/apps/jaipur-rugs`
  (`git@github.com:Vansh0508/jaipur-rugs.git`, branch `atlas-workflow-and-deploy`).
- **SSH user**: `idmt`.

## Deploying an update

```
ssh idmt@192.168.0.18
cd ~/apps/jaipur-rugs
git pull
pnpm install --frozen-lockfile    # only needed if package.json/pnpm-lock.yaml changed
cd apps/atlas
pnpm run build                    # regenerates .next — PM2 won't do this for you
pm2 restart atlas
```

Since this is a plain git checkout (not the local-build-and-ship approach the VPS uses),
**your change must be committed and pushed** before `git pull` here will pick it up —
unlike `deploy-atlas.bat`, which builds straight from whatever's on your local disk.

## A real gotcha, hit once already

Running these as a single non-interactive `ssh host "command"` (rather than an
interactive session) will fail with `pm2: command not found` or
`/usr/bin/env: 'node': No such file or directory` — `pm2`/`node` are installed via `nvm`
and only land on `PATH` in an interactive/login shell. Either SSH in properly first
(as above), or if scripting it, prefix the remote command with:

```
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

(That's the `pm2` CLI's own node version; the app itself runs on a separately-installed
v22.23.2 via PM2's `interpreter` setting — both matter, but only the CLI's needs to be on
`PATH` here.)

## Verifying

```
curl -s -o /dev/null -w "%{http_code}\n" http://192.168.0.18:3001
pm2 logs atlas --lines 30 --nostream
```

A 307 (Next.js's login redirect) is the expected healthy response, same as the VPS.
