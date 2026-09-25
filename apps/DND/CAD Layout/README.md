# CAD Layout — DnD (Design & Development)

Replaces the manual PowerPoint work DnD does for CAD layouts. A designer uploads the Tikni
BMP for each design option, fills one form with the rug details, picks B2C / JLI / B2B, and
downloads the finished deck as PPTX and PDF. The raw BMP never appears in the output — the
design goes in as a rendered PNG with Tikni's legend strip cropped off.

Requirements, decisions and open items live in [`PRD.md`](./PRD.md). The requirements
meeting is in `DnD_Meeting_Transcript_2026-09-18.md`.

## Live at http://192.168.0.18:3006 (office LAN) since 2026-09-21

PM2 process `cad-layout` on the office server, alongside Atlas. Deploy steps, and the
Node-22/PM2 trap that bit during the first deploy, are in
[`deploy/cad-layout/office-deploy.md`](../../../deploy/cad-layout/office-deploy.md).

**PDF export is not working there yet** — LibreOffice isn't installed on that box and
installing it needs a sudo password. PPTX downloads fine; the UI reports PDF as unavailable.

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

**`samples/` is gitignored and local-only.** It holds real customer jobs (~100 MB of decks,
BMPs and reference photos DnD sent), which shouldn't live in the repo or reach the deploy
server. `templates/` — the two files the app actually needs at runtime — *is* committed.
`pnpm engine:smoke` reads from `samples/`, so it only runs on a machine that has them;
copy them from `\\jvault\Univ_Share\Daily Share\Deepak\` or ask DnD.

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

## From the 2026-09-19 demo with DnD (`DnD_Demo_Transcript_2026-09-19.md`)

Output accepted. Decisions: the BMP is never stored (only rendered PNG + PPT/PDF);
colour codes are the last two digits DnD write under each legend swatch, yarn alongside
(auto-read target, format now known); B2B ≠ JLI and Big Box is its own layout — one
template map per variant once DnD's folders arrive; a **swatch** attachment (manually
cut, customer-sized) goes bottom-left, references right; dimension arrows must hug the
image (done — `dimensionShapes` in `templates.ts`).

## What DnD delivered, 2026-09-21 (`samples/dnd-2026-09-21/`)

Nine real jobs — 6 PPTX + 2 PDF — **all of the B2C "CAD Approval Sheet" family except one**.
Not what was asked for in the demo: no BMPs, no separate swatch files, no JLI, no B2B, no
Big Box, no per-variant folders. What they do give is nine real examples of how much that
one family varies in practice:

| File | Design slides | Max colours | Approval box | Swatch | `#N.` numbering | Intent label |
|---|---:|---:|:--:|:--:|:--:|---|
| `PD-14229` (19 Sep, newest) | 2 | 15 | yes | yes | yes | Rug Image / Design Intent |
| `PD-013619-ESK-316` (18 Aug) | 1 | 3 | yes | yes | yes | Rug Image / Design Intent |
| `vdr rESIDENCE` | 11 | 24 | – | – | yes | Rug Image / Design Intent |
| `QNQ-21` | 1 | 26 | – | – | yes | Design Intent |
| `PD-9800-TAQ-4309` | 3 | 8 | – | – | no | Rug Image / Color Ref Iamge |
| `NEXUS` | 2 | 6 | – | – | no | Design Intent |
| `vin Rajah` (PDF) | 2 | 2 | – | – | yes | – |
| `Workplace Interiors` (PDF) | 11 | 12 | – | – | no | **different layout** |

Useful conclusions:

- **The skeleton is stable.** Every deck shares the same shape ids for the text fields —
  `12` Date, `13` Customized Project, `17`/`18` signature lines, `19` spec labels, `37` PD +
  design code, `38` Construction, `40` JRC+ARS header, `41` spec values, colour slots at
  x=5.83 w=2.69 stacked ~0.31 apart. Only the pictures, colour count and optional blocks move.
- **Swatch geometry answered** (PD-013619, PD-14229): the swatch is a square picture on the
  **right**, with its **own** pair of dimension arrows (a second copy of the design's arrow
  group) and two equal `45 CMS` labels — one right of it, one below. The design-intent image
  sits **below** the swatch with its label above and a design-code caption underneath.
- **They embed JPEG, never BMP** — every `ppt/media/*` across all six decks is jpg/jpeg (one
  stray png/wdp). Confirms the "BMP never leaves the designer" rule the tool already follows.
- **Colour slot text is `#N. <code>-<yarn + pile>`** — e.g. `#1. 194- Silk Cut Pile`,
  `#1. M04-449-Bamboo Silk high cut pile`, `JRC-G12(515)+JRC-H13(897)-Wool Viscose Cut pile`.
  Codes are not always numeric and not always prefixed; some decks drop `#N.` entirely.
- **Dropdown values replaced** in `lib/engine/spec.ts` with what these files actually contain
  (e.g. backing is only ever `NO Backing`/`XN Backing`; edge is only ever `4 side binding`).
- **`Workplace Interiors` is a different layout** — labelled `Project:`, `Pd number:`,
  `Quantity - 1`, and colours written as `911-14 WOOL | 6MM LOW CUT`. Closest thing to the
  B2B/Big Box variant in this delivery, but it arrived as a PDF, so it can't be used as a
  template — the PPTX is still needed.
- **`Disney.pptx` (the current `templates/b2c.pptx`) is an older, simpler cut** of this family:
  no approval box, no swatch, design-intent bottom-left. `PD-14229` is two days old and has
  both — a better master, but swapping changes every B2C output, so it needs a decision.

### Done off the back of that delivery (2026-09-21)

- **`templates/b2c.pptx` is now `PD-14229`**, not `Disney.pptx`. Output gains the approval box,
  the `IMPORTANT` rendering disclaimer, the `Option-N` line and the swatch slot.
- **Swatch supported** — optional upload plus a size caption ("45 CMS") on the B2C form. When
  none is uploaded the template's own swatch, its arrows and both captions are removed, so the
  master job's swatch can't ride along into someone else's layout.
- **Colour slots are no longer capped by the template.** The engine clones the last slot when a
  design has more colours than the master job did, and tightens pitch, box height and font so
  the column still ends above the next block — 25 colours fit the 15-slot B2C master, the same
  way DnD hand-fit 26 into QNQ-21. The form now warns rather than silently dropping colours.
- **Blank fields no longer leak the master job's data.** Every mapped shape is written even when
  its value is empty — critical now that the template is a real customer's deck.
- **`pileHeightMm` split from `pileHeight`** — real decks carry both (`FINISH PILE HEIGHT :
  Standard` in the table, `Pile height – 7-8 MM` beside the image); they were previously conflated.

## Not yet done

- Per-variant template maps for JLI-vs-B2B, Big Box and any department layouts (waiting on DnD's
  PPTX files — `b2b` still points at the JLI deck).
- Colour-code auto-read (OCR of the legend strip text) once files with DnD's numbering exist.
- Manual "add colour" in the form (DnD asked for it on 19 Sep; remove/reorder already work).

- Apply `db/cad-layout/001_cad_layout_schema.sql` (run advisors, log in `db/MIGRATIONS.md`,
  regenerate `packages/supabase-client` types), then add the Edge Functions
  (`cad-layout-create-record`, signed-URL uploads to the private `cad-layout-files`
  bucket) and a "My layouts" page. Until then a generated deck lives only in its job folder.
- Grant `cad_layout.admin` to the DnD lead via the Hub role tooling once the permission row exists.
- Dropdown value lists in `lib/engine/spec.ts` are provisional — replace from DnD's reference folder.
- Colour-code auto-read from the Tikni legend strip (OCR) once DnD's team starts writing codes there.
