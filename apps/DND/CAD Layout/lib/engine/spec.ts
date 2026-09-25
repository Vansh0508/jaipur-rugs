// Shared vocabulary between the form, the API and the fill engine (PRD Section 7).

export const LAYOUT_VARIANTS = ["b2c", "jli", "b2b"] as const;
export type LayoutVariant = (typeof LAYOUT_VARIANTS)[number];

export const LAYOUT_VARIANT_LABELS: Record<LayoutVariant, string> = {
  b2c: "B2C",
  jli: "JLI (Jaipur Living)",
  b2b: "B2B",
};

/** The rug spec block — identical values on every design-option slide of one deck. */
export interface LayoutSpec {
  /** PID-6815 (JLI "Project#") / PD-12926-ND (B2C "PD number"). */
  projectNo: string;
  /** Free text shown in the header — "Hand Tufted HD-14 pic", "Hand Knotted – 11/11". */
  construction: string;
  /** B2C only — the client/project line ("Sands Solution"). */
  clientName: string;
  /** B2C only — the top-right tag, template default "Customized Project". */
  projectType: string;
  /** dd/mm/yy as DnD writes it; the form defaults to today. */
  date: string;
  size: string;
  /** B2C only — "CMS"/"Feet" etc. */
  customerMetrics: string;
  shape: string;
  rugQuality: string;
  fibreContent: string;
  dyeingTechnique: string;
  finishEdge: string;
  /** The spec-row value — in every real DnD deck this is "Standard", not a measurement. */
  pileHeight: string;
  /**
   * The measured pile height printed beside the design ("7 MM -8 MM", "12-15 MM"). A
   * separate field from `pileHeight` — real decks carry both (`FINISH PILE HEIGHT :
   * Standard` in the spec table, `Pile height – 7-8 MM` below the image).
   */
  pileHeightMm: string;
  pileType: string;
  backing: string;
  wash: string;
  width: string;
  length: string;
  /** JLI only — "Area:" in the header. */
  area: string;
  /** JLI only — "Notes:" in the footer. */
  notes: string;
}

export interface ColourSlotInput {
  hex: string;
  /** GRC / ARS code typed by the designer (auto-read from the Tikni legend is the target — PRD 4.2 item 2). */
  code: string;
  /** Optional yarn description, B2C decks show one per slot ("Silk Wool Mix Ply"). */
  yarn?: string;
}

export interface DesignOptionInput {
  /** "DI765ss-CIT05-opt-01" — the design line on the slide. */
  designCode: string;
  /** In slot order (#1 first), already filtered by the designer. */
  colours: ColourSlotInput[];
  /**
   * Physical size of the cut swatch, as printed beside it ("45 CMS"). Both of the decks
   * that carry a swatch label it on two sides with the same value.
   */
  swatchSize?: string;
}

export const SPEC_FIELD_LABELS: Record<keyof LayoutSpec, string> = {
  projectNo: "Project / PD number",
  construction: "Construction",
  clientName: "Client / project name",
  projectType: "Project type",
  date: "Date",
  size: "Size",
  customerMetrics: "Customer metrics",
  shape: "Shape",
  rugQuality: "Rug quality",
  fibreContent: "Fibre content",
  dyeingTechnique: "Dyeing technique",
  finishEdge: "Finish edge",
  pileHeight: "Finish pile height",
  pileHeightMm: "Pile height (mm, printed by the image)",
  pileType: "Finish pile type",
  backing: "Finish backing",
  wash: "Finish wash",
  width: "Width",
  length: "Length",
  area: "Area",
  notes: "Notes",
};

/**
 * Dropdown option sets, mined from the nine real DnD decks in `samples/dnd-2026-09-21/`
 * (2026-09-21 delivery — see README "What DnD delivered"). Values are listed in the
 * spelling DnD actually use, most frequent first; the invented lists these replaced had
 * options ("Serging", "Abrash", "Latex backing") that appear in none of their files.
 * Every dropdown still accepts a typed value, so a missing option never blocks a layout.
 */
export const SPEC_OPTIONS: Partial<Record<keyof LayoutSpec, string[]>> = {
  customerMetrics: ["Feet", "CMS", "Centimeters"],
  shape: ["RCT", "Round", "Square", "Oval", "IRR"],
  rugQuality: [
    "Hand Knotted 6/6",
    "Hand Knotted 8/8",
    "Hand Knotted 11/11",
    "Hand Knotted 14/14 MS PS",
    "Hand Tufted Ultra HD",
    "Hand Tufted HD",
    "Tufted Ultra HD",
  ],
  fibreContent: [
    "Bamboo Silk Wool",
    "Wool Bamboo Silk",
    "Wool",
    "Silk",
    "Silk & NZ Wool",
    "Wool Viscose",
    "Tencel Nz Wool",
    "Viscose;New Zealand Wool",
  ],
  dyeingTechnique: ["Standard"],
  finishEdge: ["4 side binding"],
  pileHeight: ["Standard"],
  pileType: ["Cut Pile"],
  backing: ["NO Backing", "XN Backing"],
  wash: ["Standard"],
};

export function emptySpec(): LayoutSpec {
  return {
    projectNo: "",
    construction: "",
    clientName: "",
    projectType: "Customized Project",
    date: "",
    size: "",
    customerMetrics: "",
    shape: "",
    rugQuality: "",
    fibreContent: "",
    dyeingTechnique: "",
    finishEdge: "",
    pileHeight: "",
    pileHeightMm: "",
    pileType: "",
    backing: "",
    wash: "",
    width: "",
    length: "",
    area: "",
    notes: "",
  };
}
