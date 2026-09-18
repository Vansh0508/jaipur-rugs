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
  pileHeight: string;
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
  pileType: "Finish pile type",
  backing: "Finish backing",
  wash: "Finish wash",
  width: "Width",
  length: "Length",
  area: "Area",
  notes: "Notes",
};

/**
 * Dropdown option sets. PROVISIONAL — seeded from the two sample decks plus common DnD
 * finishes; the real lists come with DnD's reference folder (PRD Section 2.5 item 1).
 * Every dropdown also accepts a typed value, so a missing option never blocks a layout.
 */
export const SPEC_OPTIONS: Partial<Record<keyof LayoutSpec, string[]>> = {
  shape: ["RCT", "Round", "Square", "Runner", "Oval", "Irregular"],
  pileType: ["Cut pile", "Loop pile", "Cut & Loop pile"],
  pileHeight: ["Standard pile", "Low pile", "High pile", "Standard"],
  backing: ["XN backing", "No Backing", "Cotton backing", "Latex backing"],
  finishEdge: ["4 side binding", "Serging", "Fringes", "Overlocking"],
  wash: ["Standard", "Antique wash", "No wash", "Special wash"],
  dyeingTechnique: ["Standard", "Space dyed", "Hand dyed", "Abrash"],
  customerMetrics: ["Feet", "CMS", "Inches", "Meters"],
  rugQuality: ["Hand Tufted HD", "Hand Knotted 11/11", "Hand Knotted 8/8", "Hand Knotted 10/14", "Flat Weave", "Hand Loom"],
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
    pileType: "",
    backing: "",
    wash: "",
    width: "",
    length: "",
    area: "",
    notes: "",
  };
}
