// Shape maps for the DnD-approved decks in templates/. Every id below is a `cNvPr` id
// read straight off the real files (see PRD Section 8.1/8.4 and README's inspection
// notes). If DnD ships a revised template, re-run the inspection and update this file —
// nothing else in the engine knows about slide geometry.

import type { DesignOptionInput, LayoutSpec, LayoutVariant } from "../spec";

export type SpecKey = keyof LayoutSpec;

const IN = 914400;

export interface FieldContext {
  spec: LayoutSpec;
  option: DesignOptionInput;
  optionIndex: number;
  optionCount: number;
}

export interface FieldTarget {
  id: number;
  /**
   * replace: whole text becomes the value. append: value is added after the existing
   * label run. template: whole text becomes template(value). compose: whole text (or one
   * paragraph per array entry) is built from the full context — used where one shape
   * carries several spec fields at once.
   */
  mode: "replace" | "append" | "template" | "compose";
  template?: (value: string) => string;
  compose?: (ctx: FieldContext) => string | string[];
  /** For `append` targets whose label box is too narrow for a value (EMU; 914400 = 1 in). */
  widthEmu?: number;
}

/**
 * Shapes that must follow the design image's fitted edges (DnD demo 2026-09-19: the
 * width/length arrows sat at the template's fixed positions, leaving a gap beside an
 * aspect-fitted image). `bottom` shapes track the image horizontally and keep their
 * offset from its bottom edge; `right` shapes track it vertically and keep their offset
 * from its right edge; `both` (a group holding both arrows) does both. `stretch` resizes
 * the shape with the image, `center` keeps its size and re-centres it on the image.
 */
export interface DimensionShape {
  id: number;
  anchor: "bottom" | "right" | "both";
  mode: "stretch" | "center";
}

/**
 * The numbered colour column. The template only carries as many slot shapes as its
 * source job happened to need, so the engine clones the last one when a design has more
 * colours and squeezes the pitch so the column still ends above `bandBottomEmu` — the
 * same thing DnD do by hand (QNQ-21 fits 26 slots into the band PD-14229 uses for 15).
 */
export interface ColourSlots {
  /** Existing slot shapes in slot order — index 0 is "#1". */
  ids: number[];
  /** Slots must not extend past this y (EMU) — where the next block starts. */
  bandBottomEmu: number;
}

/**
 * The cut swatch and its own dimension arrows/labels (DnD demo 2026-09-19). Removed
 * entirely when the designer doesn't upload one, so the template job's swatch never
 * leaks into someone else's layout.
 */
export interface SwatchShapes {
  picId: number;
  /** Arrow group around the swatch. */
  dimensionGroupId: number;
  /** The two size captions, both showing the same value. */
  sizeLabelIds: number[];
}

export interface TemplateSpec {
  /** Relative to templates/. */
  file: string;
  /** 0-based index of the per-design-option slide that gets cloned per option. */
  optionSlideIndex: number;
  /** 0-based indexes of sample slides to drop (extra option slides left in the source deck). */
  removeSlideIndexes: number[];
  designPicId: number;
  dimensionShapes: DimensionShape[];
  referencePicId: number;
  swatch?: SwatchShapes;
  colourSlots: ColourSlots;
  /** Leftover shapes in the source deck that aren't real slots (PRD 8.4). */
  staleShapeIds: number[];
  slotText: (slotNo: number, code: string, yarn?: string) => string;
  /** One paragraph per row, in this order, in the shape `specValuesId`. */
  specValuesId: number;
  specRows: SpecKey[];
  specRowPrefix: string;
  fields: Partial<Record<SpecKey | "designCode" | "header", FieldTarget>>;
}

const JLI: TemplateSpec = {
  file: "jli.pptx",
  optionSlideIndex: 0,
  removeSlideIndexes: [1, 2, 3],
  designPicId: 4,
  dimensionShapes: [
    { id: 28, anchor: "bottom", mode: "stretch" }, // width arrow
    { id: 37, anchor: "bottom", mode: "center" }, // "Width : …"
    { id: 29, anchor: "right", mode: "stretch" }, // length arrow
    { id: 39, anchor: "right", mode: "center" }, // "Length : …" (rotated)
  ],
  referencePicId: 32,
  colourSlots: {
    ids: [53, 51, 59, 56, 61, 63, 67, 65, 71, 69, 73, 75],
    bandBottomEmu: Math.round(6.05 * IN), // reference picture starts at 6.22 in
  },
  // Second shape labelled "#10:" on every option slide — a copy-paste leftover, not slot 13.
  staleShapeIds: [77],
  slotText: (n, code, yarn) => `#${n}: ${[code, yarn].filter(Boolean).join(" - ")}`.trimEnd(),
  specValuesId: 20,
  specRows: ["size", "shape", "rugQuality", "fibreContent", "dyeingTechnique", "finishEdge", "pileHeight", "pileType", "backing", "wash"],
  specRowPrefix: "",
  fields: {
    date: { id: 25, mode: "replace" },
    projectNo: { id: 27, mode: "replace" },
    construction: { id: 78, mode: "replace" },
    designCode: { id: 9, mode: "replace" },
    // "Area:" is right-aligned under Date/Project#; widen it to the page's right margin.
    area: { id: 10, mode: "append", widthEmu: Math.round(1.6 * IN) },
    // "Notes:" spans the rule above it (4.53 in) once there's something to say.
    notes: { id: 16, mode: "append", widthEmu: Math.round(4.5 * IN) },
    width: { id: 37, mode: "template", template: (v) => `Width : ${v}` },
    length: { id: 39, mode: "template", template: (v) => `Length : ${v}` },
  },
};

/**
 * B2C "CAD Approval Sheet" — built from `PD-14229-CAD Approval Sheet.pptx` (19 Sep 2026),
 * the newest of the nine real jobs DnD sent on 2026-09-21 and the only recent one with
 * both the approval box and the swatch. It replaced `Disney.pptx`, an older cut of the
 * same family that had neither. See README, "What DnD delivered".
 */
const B2C: TemplateSpec = {
  file: "b2c.pptx",
  optionSlideIndex: 0,
  removeSlideIndexes: [1], // slide 2 is the source job's second option; slide 3 is INFO SECTION
  designPicId: 6,
  dimensionShapes: [
    { id: 14, anchor: "both", mode: "stretch" }, // group holding both arrows
    { id: 42, anchor: "bottom", mode: "center" }, // width label
    { id: 33, anchor: "right", mode: "center" }, // length label (rotated)
  ],
  referencePicId: 7,
  swatch: { picId: 23, dimensionGroupId: 28, sizeLabelIds: [34, 35] },
  colourSlots: {
    ids: [39, 50, 53, 55, 59, 61, 63, 65, 67, 11, 4, 15, 16, 10, 9],
    bandBottomEmu: Math.round(7.65 * IN), // "Pile height" caption sits at 7.74 in
  },
  staleShapeIds: [],
  slotText: (n, code, yarn) => `#${n}. ${[code, yarn].filter(Boolean).join("-")}`.trimEnd(),
  specValuesId: 41,
  specRows: ["size", "customerMetrics", "shape", "rugQuality", "fibreContent", "dyeingTechnique", "finishEdge", "pileHeight", "pileType", "backing", "wash"],
  specRowPrefix: ": ",
  fields: {
    date: { id: 12, mode: "template", template: (v) => `Date : ${v}` },
    // One shape carries both the tag and the client ("Customized Project : Divya Somani").
    projectType: {
      id: 13,
      mode: "compose",
      compose: ({ spec }) => {
        const tag = spec.projectType.trim() || "Customized Project";
        const client = spec.clientName.trim();
        return client ? `${tag} : ${client}` : tag;
      },
    },
    // Line 1 is PD number + design code; line 2 is the option label on multi-option decks.
    header: {
      id: 37,
      mode: "compose",
      compose: ({ spec, option, optionIndex, optionCount }) => {
        const line1 = [spec.projectNo.trim(), option.designCode.trim()].filter(Boolean).join("-");
        return optionCount > 1 ? [line1, `Option-${optionIndex + 1}`] : [line1];
      },
    },
    construction: { id: 38, mode: "template", template: (v) => `Construction : ${v}` },
    pileHeightMm: { id: 48, mode: "template", template: (v) => `Pile height – ${v}` },
    length: { id: 33, mode: "replace" },
    width: { id: 42, mode: "replace" },
  },
};

export const TEMPLATES: Record<LayoutVariant, TemplateSpec> = {
  jli: JLI,
  // Unconfirmed — DnD said B2B "mostly follows JLI" on 2026-09-18, then corrected that on
  // 2026-09-19 (B2B and Big Box each have their own layout). Still JLI until they send the
  // files — PRD Section 2.5 item 2.
  b2b: JLI,
  b2c: B2C,
};

/**
 * Colours beyond this still render — the engine clones extra slots — but the column gets
 * tighter, so the form warns past it rather than silently producing a cramped deck.
 */
export function comfortableColourSlots(variant: LayoutVariant): number {
  return TEMPLATES[variant].colourSlots.ids.length;
}
