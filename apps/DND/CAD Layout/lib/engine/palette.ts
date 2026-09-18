import { toHex, type BmpImage } from "./bmp";

export interface PaletteColour {
  hex: string;
  pixelCount: number;
  /** Share of the design's pixels (legend strip excluded), 0–100. */
  areaPct: number;
  /** Position in the Tikni legend strip, 1-based; null if the colour isn't in the strip. */
  legendIndex: number | null;
  /**
   * Pure white is the Tikni canvas/margin, not a yarn colour — neither sample deck has a
   * #FFFFFF swatch even though both BMPs contain ~1% white. Flagged rather than dropped so
   * the designer can override in the form.
   */
  likelyBackground: boolean;
}

export interface LegendStrip {
  /** First row of the white gap above the strip — the design is rows [0, top). */
  top: number;
  /** Colours left-to-right as Tikni drew them. */
  order: string[];
}

export interface TikniAnalysis {
  width: number;
  /** Height of the design proper, with the legend strip and its gap cropped off. */
  designHeight: number;
  legend: LegendStrip | null;
  /** Ordered by covered area, largest first. */
  byArea: PaletteColour[];
}

const WHITE = 0xffffff;

/**
 * Tikni writes a colour-legend strip under the design (a band of swatches separated
 * from the artwork by a few all-white rows). The JLI sample deck cropped exactly that band
 * off its design photo (`srcRect b="934"`), so the engine does the same — and reads the
 * strip for Tikni's own colour order while it's there.
 */
export function analyseTikni(image: BmpImage): TikniAnalysis {
  const legend = detectLegendStrip(image);
  const designHeight = legend ? legend.top : image.height;

  const counts = new Map<string, number>();
  const { width, rgb } = image;
  const end = designHeight * width * 3;
  for (let p = 0; p < end; p += 3) {
    const hex = toHex(rgb[p]!, rgb[p + 1]!, rgb[p + 2]!);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const total = designHeight * width;
  const legendIndex = new Map<string, number>();
  legend?.order.forEach((hex, i) => legendIndex.set(hex, i + 1));

  const byArea: PaletteColour[] = [...counts.entries()]
    .map(([hex, pixelCount]) => ({
      hex,
      pixelCount,
      areaPct: (pixelCount / total) * 100,
      legendIndex: legendIndex.get(hex) ?? null,
      likelyBackground: hex === "FFFFFF",
    }))
    .sort((a, b) => b.pixelCount - a.pixelCount);

  return { width, designHeight, legend, byArea };
}

/**
 * Colours ordered by covered area, largest first — the rule DnD stated for the tool
 * (meeting 2026-09-18, 10:34). PRD Section 8.4: target behaviour, still to be confirmed
 * against a DnD-approved output; the form also offers the Tikni legend order.
 */
export function extractPalette(image: BmpImage): PaletteColour[] {
  return analyseTikni(image).byArea;
}

function detectLegendStrip(image: BmpImage): LegendStrip | null {
  const { width, height, rgb } = image;
  const rowPixel = (y: number, x: number) => {
    const p = (y * width + x) * 3;
    return (rgb[p]! << 16) | (rgb[p + 1]! << 8) | rgb[p + 2]!;
  };
  const rowIsWhite = (y: number) => {
    for (let x = 0; x < width; x++) if (rowPixel(y, x) !== WHITE) return false;
    return true;
  };

  // The strip can only live in the bottom slice of the image.
  const searchFloor = Math.floor(height * 0.85);
  let y = height - 1;
  while (y > searchFloor && rowIsWhite(y)) y--; // trailing white margin, if any
  const stripBottom = y;
  while (y > searchFloor && !rowIsWhite(y)) y--; // the swatch rows
  const stripTop = y + 1;
  if (stripBottom - stripTop < 4 || y <= searchFloor) return null;
  let gapRows = 0;
  while (y > searchFloor && rowIsWhite(y)) {
    gapRows++;
    y--;
  }
  if (gapRows < 2) return null;
  const top = y + 1;

  const mid = Math.floor((stripTop + stripBottom) / 2);
  const order: string[] = [];
  let prev = -1;
  for (let x = 0; x < width; x++) {
    const c = rowPixel(mid, x);
    if (c === prev) continue;
    prev = c;
    if (c === WHITE) continue;
    const hex = c.toString(16).padStart(6, "0").toUpperCase();
    if (!order.includes(hex)) order.push(hex);
  }
  if (order.length < 2) return null;
  return { top, order };
}

/** Perceived luminance for picking readable label text over a swatch. */
export function isLightColour(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
