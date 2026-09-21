"use client";

import { TextField } from "@jaipur-rugs/ui-kit";
import { SPEC_FIELD_LABELS, SPEC_OPTIONS, type LayoutSpec, type LayoutVariant } from "@/lib/engine/spec";
import { ComboField } from "./ComboField";

type SpecKey = keyof LayoutSpec;

/** Which fields each deck actually has a place for — mirrors lib/engine/pptx/templates.ts. */
const FIELDS_BY_VARIANT: Record<LayoutVariant, SpecKey[]> = {
  jli: ["projectNo", "date", "construction", "area", "size", "shape", "rugQuality", "fibreContent", "dyeingTechnique", "finishEdge", "pileHeight", "pileType", "backing", "wash", "width", "length", "notes"],
  b2b: ["projectNo", "date", "construction", "area", "size", "shape", "rugQuality", "fibreContent", "dyeingTechnique", "finishEdge", "pileHeight", "pileType", "backing", "wash", "width", "length", "notes"],
  b2c: ["projectNo", "date", "clientName", "projectType", "construction", "size", "customerMetrics", "shape", "rugQuality", "fibreContent", "dyeingTechnique", "finishEdge", "pileHeight", "pileHeightMm", "pileType", "backing", "wash", "width", "length"],
};

const LABEL_OVERRIDES: Partial<Record<LayoutVariant, Partial<Record<SpecKey, string>>>> = {
  jli: { projectNo: "Project# (PID)" },
  b2b: { projectNo: "Project# (PID)" },
  b2c: { projectNo: "PD number" },
};

const PLACEHOLDERS: Partial<Record<SpecKey, string>> = {
  projectNo: "PID-6815 / PD-12926-ND",
  construction: "Hand Tufted HD-14 pic",
  date: "dd/mm/yy",
  size: "14 ft X 19 ft",
  width: "14 ft",
  length: "19 ft",
  area: "266 sq ft",
  fibreContent: "Wool Viscose",
  pileHeight: "Standard",
  pileHeightMm: "7 MM -8 MM",
};

export function SpecFields({
  variant,
  spec,
  onChange,
}: {
  variant: LayoutVariant;
  spec: LayoutSpec;
  onChange: (next: LayoutSpec) => void;
}) {
  const set = (key: SpecKey) => (value: string) => onChange({ ...spec, [key]: value });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {FIELDS_BY_VARIANT[variant].map((key) => {
        const label = LABEL_OVERRIDES[variant]?.[key] ?? SPEC_FIELD_LABELS[key];
        const options = SPEC_OPTIONS[key];
        if (options) {
          return <ComboField key={key} label={label} value={spec[key]} onChange={set(key)} options={options} placeholder={PLACEHOLDERS[key]} />;
        }
        return <TextField key={key} label={label} value={spec[key]} onChange={set(key)} placeholder={PLACEHOLDERS[key]} fullWidth />;
      })}
    </div>
  );
}
