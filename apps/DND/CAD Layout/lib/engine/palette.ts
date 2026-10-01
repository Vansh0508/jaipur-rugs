import { toHex, type BmpImage } from "./bmp";
import { countColours } from "./image";

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

// A Tikni BMP's gap rows are a literal #FFFFFF (it's a synthetic export, no noise). A real
// JPEG/PNG photo of a visualization (2026-10-01, "QNQ-66-02 (Visualization)(1).jpg") never
// hits that exactly — compression and anti-aliasing leave every "white" row a few shades
// off — so requiring an exact match made detectLegendStrip return null for every such file,
// and its legend strip (colour-code swatches, e.g. "M12 M04 M07...") rode along into the
// embedded design image uncropped. NEAR_WHITE_MIN and the row tolerance below let a mostly-
// white row with a little real-world noise still count as the gap.
const NEAR_WHITE_MIN = 243;
const ROW_NON_WHITE_TOLERANCE = 0.01;
// Swatches in a rendered/photographed legend aren't a single flat hex either — merge runs
// of similar colour the same way image.ts's quantizer does, instead of grouping by exact
// equality, or compression noise would split one swatch into dozens of spurious "colours".
const SWATCH_MERGE_DISTANCE = 20;

function isNearWhite(r: number, g: number, b: number): boolean {
  return r >= NEAR_WHITE_MIN && g >= NEAR_WHITE_MIN && b >= NEAR_WHITE_MIN;
}

/**
 * Tikni writes a colour-legend strip under the design (a band of swatches separated
 * from the artwork by a few all-white rows). The JLI sample deck cropped exactly that band
 * off its design photo (`srcRect b="934"`), so the engine does the same — and reads the
 * strip for Tikni's own colour order while it's there.
 */
export function analyseTikni(image: BmpImage): TikniAnalysis {
  const legend = detectLegendStrip(image);
  const designHeight = legend ? legend.top : image.height;

  const { width, rgb } = image;
  const end = designHeight * width * 3;
  // Same exact-then-quantize counting a JPG/PNG gets in image.ts — a raw per-pixel exact
  // scan here would defeat that quantization the moment a legend-strip crop applied
  // (2026-09-28: a photographic JPEG reached the app as a 299,022-"colour" palette
  // because this used to always count exactly, regardless of continuous-tone input).
  // For a real indexed BMP, colour counts stay small and this still comes back exact.
  const counts = countColours(rgb.subarray(0, end));
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
  const rowPixel = (y: number, x: number): [number, number, number] => {
    const p = (y * width + x) * 3;
    return [rgb[p]!, rgb[p + 1]!, rgb[p + 2]!];
  };
  const rowIsWhite = (y: number) => {
    let nonWhite = 0;
    const limit = width * ROW_NON_WHITE_TOLERANCE;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rowPixel(y, x);
      if (!isNearWhite(r, g, b) && ++nonWhite > limit) return false;
    }
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
  // Merge runs of similar colour (see SWATCH_MERGE_DISTANCE) rather than grouping by exact
  // equality — a photographed/rendered swatch is rarely a single flat hex. A code label
  // printed over/under the swatch (e.g. "M12") cuts a few stray pixels into the run too, so
  // a run shorter than MIN_RUN_WIDTH is text/antialiasing noise, not a real swatch.
  const MIN_RUN_WIDTH = Math.max(6, Math.round(width * 0.01));
  const order: string[] = [];
  let runR = 0;
  let runG = 0;
  let runB = 0;
  let runCount = 0;
  const flushRun = () => {
    if (runCount < MIN_RUN_WIDTH) {
      runR = runG = runB = runCount = 0;
      return;
    }
    const r = runR / runCount;
    const g = runG / runCount;
    const b = runB / runCount;
    if (!isNearWhite(r, g, b)) order.push(toHex(Math.round(r), Math.round(g), Math.round(b)));
    runR = runG = runB = runCount = 0;
  };
  for (let x = 0; x < width; x++) {
    const [r, g, b] = rowPixel(mid, x);
    if (runCount > 0) {
      const dr = r - runR / runCount;
      const dg = g - runG / runCount;
      const db = b - runB / runCount;
      if (Math.sqrt(dr * dr + dg * dg + db * db) > SWATCH_MERGE_DISTANCE) flushRun();
    }
    runR += r;
    runG += g;
    runB += b;
    runCount++;
  }
  flushRun();
  // `top` came from real gap/strip geometry (white-margin, then non-white rows, then a
  // white gap) — crop on that regardless of how clean `order` came out, so a legend strip
  // that's hard to read colour-by-colour (noisy photo, label text crossing every swatch)
  // still gets cut off the design image rather than leaving it in because of this alone
  // (2026-10-01: that exact failure mode, `order.length < 2` returning null here, undid
  // the crop entirely for a real DnD visualization JPEG).
  return { top, order };
}

/** Perceived luminance for picking readable label text over a swatch. */
export function isLightColour(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
