// Shape maps for the two DnD-approved decks in templates/. Every id below is a `cNvPr`
// id read straight off the sample files (see PRD Section 8.1/8.4 and the inspection
// notes in README.md). If DnD ships a revised template, re-run the inspection and update
// this file — nothing else in the engine knows about slide geometry.

import type { LayoutSpec, LayoutVariant } from "../spec";

export type SpecKey = keyof LayoutSpec;

export interface FieldTarget {
  id: number;
  /** replace: whole text becomes the value. append: value is added after the existing label run. template: whole text becomes template(value). */
  mode: "replace" | "append" | "template";
  template?: (value: string) => string;
  /** For `append` targets whose label box is too narrow for a value (EMU; 914400 = 1 in). */
  widthEmu?: number;
}

export interface TemplateSpec {
  /** Relative to templates/. */
  file: string;
  /** 0-based index of the per-design-option slide that gets cloned per option. */
  optionSlideIndex: number;
  /** 0-based indexes of sample slides to drop (extra option slides left in the source deck). */
  removeSlideIndexes: number[];
  designPicId: number;
  referencePicId: number;
  /** cNvPr ids in slot order: index 0 is "#1". */
  colourSlotIds: number[];
  /** Leftover shapes in the source deck that aren't real slots (PRD 8.4). */
  staleShapeIds: number[];
  slotText: (slotNo: number, code: string, yarn?: string) => string;
  /** One paragraph per row, in this order, in the shape `specValuesId`. */
  specValuesId: number;
  specRows: SpecKey[];
  specRowPrefix: string;
  fields: Partial<Record<SpecKey | "designCode", FieldTarget>>;
}

const JLI: TemplateSpec = {
  file: "jli.pptx",
  optionSlideIndex: 0,
  removeSlideIndexes: [1, 2, 3],
  designPicId: 4,
  referencePicId: 32,
  colourSlotIds: [53, 51, 59, 56, 61, 63, 67, 65, 71, 69, 73, 75],
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
    area: { id: 10, mode: "append", widthEmu: Math.round(1.6 * 914400) },
    // "Notes:" spans the rule above it (4.53 in) once there's something to say.
    notes: { id: 16, mode: "append", widthEmu: Math.round(4.5 * 914400) },
    width: { id: 37, mode: "template", template: (v) => `Width : ${v}` },
    length: { id: 39, mode: "template", template: (v) => `Length : ${v}` },
  },
};

const B2C: TemplateSpec = {
  file: "b2c.pptx",
  optionSlideIndex: 0,
  removeSlideIndexes: [],
  designPicId: 10,
  referencePicId: 6,
  colourSlotIds: [4, 2, 15, 11, 20, 16, 24, 23, 26, 25, 28, 27, 30, 29, 34, 31, 45, 44, 48, 47, 50, 49, 43, 39, 9],
  staleShapeIds: [],
  slotText: (n, code, yarn) => `#${n}. ${[code, yarn].filter(Boolean).join(" - ")}`.trimEnd(),
  specValuesId: 41,
  specRows: ["size", "customerMetrics", "shape", "rugQuality", "fibreContent", "dyeingTechnique", "finishEdge", "pileHeight", "pileType", "backing", "wash"],
  specRowPrefix: ": ",
  fields: {
    date: { id: 12, mode: "template", template: (v) => `Date : ${v}` },
    projectType: { id: 13, mode: "replace" },
    projectNo: { id: 37, mode: "replace" },
    construction: { id: 38, mode: "template", template: (v) => `Construction : ${v}` },
    clientName: { id: 32, mode: "replace" },
    pileHeight: { id: 46, mode: "template", template: (v) => `Pile Height – ${v}` },
    length: { id: 33, mode: "replace" },
    width: { id: 42, mode: "replace" },
  },
};

export const TEMPLATES: Record<LayoutVariant, TemplateSpec> = {
  jli: JLI,
  // Unconfirmed — DnD said B2B "mostly follows JLI" (PRD Section 2.5 item 2). Same deck
  // until the reference folder says otherwise.
  b2b: JLI,
  b2c: B2C,
};

export function maxColourSlots(variant: LayoutVariant): number {
  return TEMPLATES[variant].colourSlotIds.length;
}
