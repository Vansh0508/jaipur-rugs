import type { PaletteResponse } from "@/lib/api";
import type { LayoutVariant } from "@/lib/engine/spec";

export type ColourOrdering = "area" | "legend";

export interface ColourRow {
  hex: string;
  areaPct: number;
  legendIndex: number | null;
  code: string;
  yarn: string;
  included: boolean;
}

export interface DesignOptionState {
  key: string;
  designCode: string;
  bmp: File | null;
  bmpName: string;
  palette: PaletteResponse | null;
  paletteError: string | null;
  loadingPalette: boolean;
  ordering: ColourOrdering;
  colours: ColourRow[];
  references: File[];
}

export function newOption(): DesignOptionState {
  return {
    key: Math.random().toString(36).slice(2),
    designCode: "",
    bmp: null,
    bmpName: "",
    palette: null,
    paletteError: null,
    loadingPalette: false,
    ordering: "area",
    colours: [],
    references: [],
  };
}

export function rowsFromPalette(palette: PaletteResponse, ordering: ColourOrdering, previous: ColourRow[] = []): ColourRow[] {
  const remembered = new Map(previous.map((r) => [r.hex, r]));
  const rows: ColourRow[] = palette.colours.map((c) => ({
    hex: c.hex,
    areaPct: c.areaPct,
    legendIndex: c.legendIndex,
    code: remembered.get(c.hex)?.code ?? "",
    yarn: remembered.get(c.hex)?.yarn ?? "",
    included: remembered.get(c.hex)?.included ?? !c.likelyBackground,
  }));
  if (ordering === "legend" && palette.legendOrder) {
    const pos = new Map(palette.legendOrder.map((hex, i) => [hex, i]));
    rows.sort((a, b) => (pos.get(a.hex) ?? 999) - (pos.get(b.hex) ?? 999) || b.areaPct - a.areaPct);
  }
  return rows;
}

export function todayDdMmYy(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

export const VARIANT_HELP: Record<LayoutVariant, string> = {
  jli: "Jaipur Living deck — 12 colour slots, policies slide at the end.",
  b2b: "B2B — currently the same deck as JLI until DnD confirms otherwise.",
  b2c: "Jaipur Rugs B2C deck — up to 25 colour slots with yarn type, INFO SECTION slide at the end.",
};
