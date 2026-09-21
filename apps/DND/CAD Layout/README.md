# CAD Layout — DnD (Design & Development)

Replaces the manual PowerPoint work DnD does for CAD layouts. A designer uploads the Tikni
BMP for each design option, fills one form with the rug details, picks B2C / JLI / B2B, and
downloads the finished deck as PPTX and PDF. The raw BMP never appears in the output — the
design goes in as a rendered PNG with Tikni's legend strip cropped off.

Requirements, decisions and open items live in [`PRD.md`](./PRD.md). The requirements
meeting is in `DnD_Meeting_Transcript_2026-09-18.md`.

## Status (2026-09-18)

| Piece | State |
|---|---|
| Conversion engine (`lib/engine/`) | Working, smoke-tested against the real sample files (`pnpm engine:smoke`) |
| Web app (`/new`) | Working end-to-end without a database: form → palette → PPTX + PDF download |
| Auth | Supabase session via `packages/auth`; any **active employee** can use it; `cad_layout.admin` unlocks the usage view |
| DB module (`db/cad-layout/`) | ERD + `001_cad_layout_schema.sql` **written, not applied** — see `db/MIGRATIONS.md` |
| Persistence (records, Storage bucket, Edge Functions) | Not started — waits on the migration being applied |
| Open items with DnD | PRD Section 2.5 (reference folder, B2B, R&D, colour rule, colour-code auto-read) |

## Run locally

```bash
pnpm install                       # from the repo root
cp .env.example .env.local         # fill NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY
pnpm dev                           # http://localhost:3006
pnpm engine:smoke                  # writes scripts/out/smoke-{jli,b2c}.{pptx,pdf}
pnpm type-check
```

PDF export needs a converter on the machine: LibreOffice (`soffice` on PATH or
`SOFFICE_PATH`) or, on Windows, an installed PowerPoint (driven via `cscript` late-bound
COM — PowerShell's `-ComObject` route fails on Click-to-Run Office). Without either, the
PPTX still downloads and the UI reports the PDF as unavailable.

## How it works

```
Tikni BMP ──parseBmp──▶ palette (indexed) + RGB
                │
                ├─ analyseTikni: find the legend strip (design rows / white gap / swatch
                │  band at the bottom), crop it, count area per colour on the design only,
                │  read Tikni's own left-to-right colour order from the strip
                │
                ▼
      form: colours ordered by area (default) or Tikni legend; designer ticks/un-ticks,
      reorders, types GRC/ARS codes (auto-read from the legend is the target — PRD 4.2)
                │
                ▼
generateDeck ──▶ templates/{jli,b2c}.pptx opened as OOXML (jszip + xmldom)
                  • option slide cloned once per design option; sample-only slides dropped
                  • spec text runs rewritten in place (fonts/colours cloned from the template)
                  • colour-slot shapes: solid fill = swatch hex, text = "#N: CODE", text colour
                    picked for contrast; unused slots and the stale duplicate "#10" removed
                  • design picture → legend-cropped PNG, aspect-fit into the template frame
                  • reference images aspect-fit into the design-intent frame (grid if several)
                  • orphaned template media pruned, identical images de-duplicated
                │
                ▼
      layout.pptx ──soffice / PowerPoint──▶ layout.pdf   (per-job folder, swept after 24 h)
```

Every edited shape is addressed by its `cNvPr` id in
[`lib/engine/pptx/templates.ts`](./lib/engine/pptx/templates.ts). If DnD hands over a
revised deck, re-inspect it (python-pptx or the notes in PRD 8.1) and update that file
only.

## Layout

```
app/
  (shell)/new          the one-page form (LayoutForm + DesignOptionCard + ColourTable)
  (shell)/admin        usage view — admin only, reads cad_layout_usage_view once applied
  api/palette          POST BMP → colours, legend order, preview
  api/generate         POST multipart (payload JSON + bmp_i + ref_i_j) → job id + URLs
  api/download/[job]/[pptx|pdf]
  login, api/force-logout
lib/engine/            bmp.ts palette.ts png.ts pdf.ts pptx/{package,xml,templates,fill}.ts
lib/auth/              requireCadLayoutAccess (page) / getCadLayoutEmployee (route handlers)
proxy.ts               session + active-employee gate (Next 16 name for middleware)
templates/             jli.pptx (also used for b2b), b2c.pptx — DnD's approved decks
samples/               real Tikni BMPs + decks used by the smoke test
db/cad-layout/         (repo root) ERD + migration for the persistence layer
```

## Deployment

Same shape as the sibling BOM Checker and Atlas: a plain Node process under PM2 on the
internal Linux server, **not** Vercel — the PDF step needs LibreOffice installed on the
host (PRD Section 4.4 requests this as a recorded AGENTS.md exception).

```bash
sudo apt-get install -y libreoffice-impress fonts-crosextra-carlito   # once, on the server
pnpm install && pnpm build
pm2 start ecosystem.config.cjs && pm2 save
```

Fonts matter for the PDF: the templates use Tw Cen MT / Microsoft JhengHei / Arial. Install
the closest metric-compatible fonts on the server or accept LibreOffice's substitutions;
check one PDF against PowerPoint's output before going live.

## Not yet done

- Apply `db/cad-layout/001_cad_layout_schema.sql` (run advisors, log in `db/MIGRATIONS.md`,
  regenerate `packages/supabase-client` types), then add the Edge Functions
  (`cad-layout-create-record`, signed-URL uploads to the private `cad-layout-files`
  bucket) and a "My layouts" page. Until then a generated deck lives only in its job folder.
- Grant `cad_layout.admin` to the DnD lead via the Hub role tooling once the permission row exists.
- Dropdown value lists in `lib/engine/spec.ts` are provisional — replace from DnD's reference folder.
- Colour-code auto-read from the Tikni legend strip (OCR) once DnD's team starts writing codes there.
