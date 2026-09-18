# Handover Prompt — DnD CAD Layout Tool

Paste the block below as the first message in a Claude Code session opened at
`G:\Automation\MonoRepo\jaipur-rugs\apps\DND\CAD Layout`.

---

I am handing over the **DnD CAD Layout automation** project. Work from this folder
(`apps/DND/CAD Layout`) inside the `jaipur-rugs` monorepo.

## Read first, in this order
1. `../../../AGENTS.md` — the monorepo execution playbook. Tech stack is fixed
   (Next.js App Router, TypeScript, Supabase, Hero UI, pnpm + Turborepo). Section 3.1
   (DB planning), 7 and 8 (Do's / Don'ts), 9 (security) are binding.
2. `../../../PRD_TEMPLATE.md` — the PRD must be filled and approved before scaffolding
   or migrations. Planning is not execution.
3. `../../../architecture.md` — module tracker; this app will need a row.
4. `../BOM Checker/` — the sibling DnD app. Match its structure, README, CLAUDE.md,
   deployment approach and conventions unless there is a documented reason not to.
5. `DnD_Meeting_Transcript_2026-09-18.md` in this folder — verbatim requirements
   meeting with the DnD users, plus a summary and action items at the bottom.

## What is being built
A web tool that replaces the manual PowerPoint work DnD does for CAD layouts.
A designer uploads the Tikni BMP design file, fills a one-page form with the
variable rug details, picks a layout type, and downloads the finished layout as
PPTX and PDF. The raw BMP must never appear in the output.

### Sample files in this folder (real data, use for tests)
| File | What it is |
|---|---|
| `di765ss_CAD Contract - JAIPUR LIVING RENDER PID-6815.pptx` | **JLI (Jaipur Living) layout** template. 5 slides, one per design option. Fields: Project#, Construction, Notes, Size, Shape, Rug Quality, Fibre Content, Dyeing Technique, Finish Edge / Pile Height / Pile Type / Backing / Wash, Width, Length, Date, Area, PID, Design code, Approval box, 12 numbered colour slots. |
| `Disney.pptx` | **B2C layout** template. Slide 1 = spec sheet with PD number, JRC + ARS reference, up to 25 numbered colour slots with yarn type, Rug Image / Design Intent area, signature and approval lines. Slide 2 = fixed INFO SECTION terms text. |
| `SHm-4.bmp` | Tikni design file, indexed colour, 26 palette entries. |
| `TAQ-622-14-4X19-LAOUT-Deepak-01.bmp` | Tikni design file, indexed colour, 16 palette entries. |

### Confirmed requirements (from the meeting)
- Three layout variants: **B2C**, **JLI**, **B2B**. B2B is unconfirmed and probably
  identical to JLI. User picks the variant in the tool.
- Fixed template text (labels, disclaimers, address, approval lines) stays as-is.
  Only the variable fields are filled from the form.
- Fields with standard values (shape, pile type, backing, edge, wash etc.) become
  dropdowns. Free-text fields stay editable.
- Colours are read automatically from the uploaded BMP palette and ordered by area
  covered, largest first (the border colour is usually #1). Files may have up to 25
  colours. The designer types the GRC / ARS colour code against each detected colour.
- Reference / design-intent images are attached in the form. Usually one, sometimes
  more, so allow multiple. No shared network folder path; attachments live with the
  record.
- Multi-file layouts (several designs in one deck, one slide each) must be supported.
- Output: PPTX and PDF of the layout only.

### Open items to resolve with DnD before finalising
1. DnD promised a reference folder: B2C, JLI and B2B layouts, one multi-file example,
   and JPG conversions of BMPs, marked as "design" vs "reference image". Ask for it.
2. Confirm whether B2B differs from JLI.
3. Confirm whether R&D follows the same format as DnD.
4. Confirm the colour sequence rule (by area covered vs. by legend order in the Tikni
   file) and how colour codes will be supplied.

## What I want you to do now
1. Read the files listed above. Do not scaffold anything yet.
2. Draft `PRD.md` in this folder from `PRD_TEMPLATE.md`, Track A, owning department
   DnD, filling everything the transcript and samples support and marking the four
   open items as blockers.
3. Propose the technical design inside the PRD: how the BMP palette is extracted and
   ordered, how the PPTX templates are filled (template shapes and text runs, not
   regenerated decks), how PDF export is produced on the server, what tables if any
   are needed in the shared Supabase project per AGENTS.md 3.1, and where uploaded
   BMPs and reference images are stored per the object storage rule in AGENTS.md 1.
4. Stop and present the PRD for review. Scaffolding, migrations and code start only
   after sign-off.

Report back with the PRD and a short list of anything in the samples that
contradicts the transcript.
