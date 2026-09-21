<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CAD Layout app notes

The monorepo rules in `../../../AGENTS.md` are binding here. App-specific:

- Read `PRD.md` before changing behaviour — the open items in its Section 2.5 are real
  unknowns (B2B template, R&D scope, colour ordering rule, colour-code auto-read), not
  things to guess at.
- Template edits are id-driven: every shape the engine touches is listed in
  `lib/engine/pptx/templates.ts` by `cNvPr` id. Don't regenerate slides; edit runs/fills in
  place so DnD's fixed text survives byte-for-byte.
- The raw Tikni BMP must never be embedded in or downloadable from an output. Only the
  legend-cropped PNG goes into the deck (`lib/engine/pptx/fill.ts`).
- Any active employee may use the tool and sees only their own jobs/records; the
  `cad_layout.admin` permission (db/cad-layout/001) sees everything. Keep both checks —
  proxy.ts and the shell layout / route handlers — as they are (AGENTS.md Section 5).
- `pnpm engine:smoke` is the regression check for the engine; run it after touching
  anything under `lib/engine/` and open the PDFs it writes to `scripts/out/`.
