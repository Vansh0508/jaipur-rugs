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
   * The code printed on this colour's legend swatch (e.g. "M12"), read by OCR — null until
   * `readTikniCodes` (ocr.ts) fills it in, or if nothing legible was found. DnD confirmed
   * (Ritika Singh, 2026-10-02: "yes" these should pre-fill the GRC/ARS code box) these
   * labels are real colour codes, not just Tikni-internal bookkeeping.
   */
  tikniCode: string | null;
  /**
   * Pure white is the Tikni canvas/margin, not a yarn colour — neither sample deck has a
   * #FFFFFF swatch even though both BMPs contain ~1% white. Flagged rather than dropped so
   * the designer can override in the form.
   */
  likelyBackground: boolean;
}

export interface LegendSwatch {
  /** The swatch's own fill colour (its most common pixel, not skewed by the code text on it). */
  hex: string;
  /** Pixel columns [xStart, xEnd) the swatch spans, for cropping its code text for OCR. */
  xStart: number;
  xEnd: number;
  /** The byArea colour this swatch's fill nearest-matches, if within tolerance. */
  matchedHex: string | null;
}

export interface LegendStrip {
  /** First row of the white gap above the strip — the design is rows [0, top). */
  top: number;
  /** Row range of the swatches themselves (inclusive), for cropping their code text for OCR. */
  stripTop: number;
  stripBottom: number;
  /** Colours left-to-right as Tikni drew them. */
  order: string[];
  swatches: LegendSwatch[];
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
// 2026-10-03, "TNQ-1124...-LAOUT-Fa.jpg" (the JPG DnD actually shared for this job, over
// Output Messenger, rather than the clean Tikni BMP): even its margin/gap rows carry 5–8%
// non-white pixels from re-compression noise, so 1% rejected every row as "not a gap" and
// detectLegendStrip returned null — the whole image (legend included) then went into
// colour counting, surfacing 24 "colours" for a design CAD records as 3 tikni. 0.07 is the
// widest tolerance that still cleanly separates design/gap/swatch bands on both that file
// and the earlier real sample ("QNQ-66-02 (Visualization)(1).jpg") — both resolve to the
// correct 3 legend swatches at this value.
const ROW_NON_WHITE_TOLERANCE = 0.07;

function isNearWhite(r: number, g: number, b: number): boolean {
  return r >= NEAR_WHITE_MIN && g >= NEAR_WHITE_MIN && b >= NEAR_WHITE_MIN;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/**
 * Tikni writes a colour-legend strip under the design (a band of swatches separated
 * from the artwork by a few all-white rows). The JLI sample deck cropped exactly that band
 * off its design photo (`srcRect b="934"`), so the engine does the same — and reads the
 * strip for Tikni's own colour order while it's there.
 */
// How close a legend swatch's own fill colour has to be to a byArea colour to call them the
// same yarn colour. Each side comes from a different averaging/quantizing pass (the design's
// pixels vs. the legend strip's), so they're never exactly equal even for a real Tikni BMP —
// matching on exact hex (the previous approach) matched essentially nothing.
const LEGEND_MATCH_DISTANCE = 40;

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

  const byArea: PaletteColour[] = [...counts.entries()]
    .map(([hex, pixelCount]) => ({
      hex,
      pixelCount,
      areaPct: (pixelCount / total) * 100,
      legendIndex: null as number | null,
      tikniCode: null as string | null,
      // Exact #FFFFFF catches a clean Tikni BMP's canvas, but a photographed/re-compressed
      // JPG never lands on exact white (2026-10-03, "TNQ-1124-...-LAOUT-Fa.jpg": its margin
      // came back as #FBFBFB) — that near-white tolerance is the same NEAR_WHITE_MIN already
      // used to find the legend gap, so it should flag as background too rather than
      // surfacing as a spurious 4th "colour" alongside the design's 3 real ones.
      likelyBackground: isNearWhite(...hexToRgb(hex)),
    }))
    .sort((a, b) => b.pixelCount - a.pixelCount);

  if (legend) {
    // A clean Tikni BMP legend has one swatch per colour, so this match is unambiguous. A
    // photographed/rendered legend doesn't always segment that cleanly (2026-10-02,
    // "QNQ-66-02 (Visualization)(1).jpg": column-gap detection found 15 swatch regions for
    // 8 real colours — some swatches' own internal shading broke the gap scan mid-box). When
    // more than one swatch nearest-matches the same colour, that's this failure mode, not a
    // real one-to-many legend, so the match is unreliable for all of them — leave the colour
    // unmatched (no legendIndex, no OCR'd code) rather than attributing one swatch's code to
    // it by chance, per the explicit 2026-10-02 call to leave a field blank over guessing.
    const matchesByColour = new Map<PaletteColour, number[]>();
    legend.swatches.forEach((swatch, i) => {
      let best: PaletteColour | null = null;
      let bestDist = Infinity;
      for (const colour of byArea) {
        const d = hexDistance(swatch.hex, colour.hex);
        if (d < bestDist) {
          bestDist = d;
          best = colour;
        }
      }
      if (best && bestDist <= LEGEND_MATCH_DISTANCE) {
        matchesByColour.set(best, [...(matchesByColour.get(best) ?? []), i]);
      }
    });
    matchesByColour.forEach((swatchIndices, colour) => {
      if (swatchIndices.length !== 1) return;
      const i = swatchIndices[0]!;
      colour.legendIndex = i + 1;
      legend.swatches[i]!.matchedHex = colour.hex;
    });
  }

  return { width, designHeight, legend, byArea };
}

function hexDistance(a: string, b: string): number {
  const dr = parseInt(a.slice(0, 2), 16) - parseInt(b.slice(0, 2), 16);
  const dg = parseInt(a.slice(2, 4), 16) - parseInt(b.slice(2, 4), 16);
  const db = parseInt(a.slice(4, 6), 16) - parseInt(b.slice(4, 6), 16);
  return Math.sqrt(dr * dr + dg * dg + db * db);
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
  const rowNonWhiteCount = (y: number) => {
    let nonWhite = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rowPixel(y, x);
      if (!isNearWhite(r, g, b)) nonWhite++;
    }
    return nonWhite;
  };
  const rowIsWhite = (y: number) => rowNonWhiteCount(y) <= width * ROW_NON_WHITE_TOLERANCE;

  // The strip can only live in the bottom slice of the image.
  const searchFloor = Math.floor(height * 0.85);
  let y = height - 1;
  while (y > searchFloor && rowIsWhite(y)) y--; // trailing white margin, if any
  let stripBottom = y;
  while (y > searchFloor && !rowIsWhite(y)) y--; // the swatch rows
  let stripTop = y + 1;
  if (stripBottom - stripTop < 4 || y <= searchFloor) return null;
  // A visualization export's canvas can end in a solid border/frame line right at the image
  // edge, with no white margin separating it from the swatches above (2026-10-01,
  // "QNQ-66-02 (Visualization)(1).jpg": rows 2216–2218 were 90–100% non-white edge-to-edge,
  // vs. 15–30% for the actual swatch-and-gap rows above them). That's dense enough to look
  // non-white in every column, which would otherwise erase every swatch gap and merge the
  // whole strip into one "swatch". Trim rows that dense off either edge of the band first.
  const BORDER_DENSITY = width * 0.6;
  while (stripBottom > stripTop && rowNonWhiteCount(stripBottom) > BORDER_DENSITY) stripBottom--;
  while (stripTop < stripBottom && rowNonWhiteCount(stripTop) > BORDER_DENSITY) stripTop++;
  if (stripBottom - stripTop < 4) return null;
  let gapRows = 0;
  while (y > searchFloor && rowIsWhite(y)) {
    gapRows++;
    y--;
  }
  if (gapRows < 2) return null;
  const top = y + 1;

  // Find swatch x-ranges from whole-height column gaps, not one sampled row — a code label
  // printed inside a swatch (e.g. "M12") sits on only *some* rows, but the white gap between
  // two swatch boxes is white top-to-bottom, so it survives this scan even where a single
  // mid-row scan would have run straight through a digit.
  const MIN_SWATCH_WIDTH = Math.max(6, Math.round(width * 0.01));
  const stripHeight = stripBottom - stripTop + 1;
  const colIsGap = (x: number) => {
    let nonWhite = 0;
    const limit = stripHeight * ROW_NON_WHITE_TOLERANCE;
    for (let y = stripTop; y <= stripBottom; y++) {
      const [r, g, b] = rowPixel(y, x);
      if (!isNearWhite(r, g, b) && ++nonWhite > limit) return false;
    }
    return true;
  };

  const swatches: LegendSwatch[] = [];
  let runStart = -1;
  const closeRun = (x: number) => {
    if (runStart < 0) return;
    if (x - runStart >= MIN_SWATCH_WIDTH) {
      swatches.push({ hex: averageRectColour(image, runStart, x, stripTop, stripBottom + 1), xStart: runStart, xEnd: x, matchedHex: null });
    }
    runStart = -1;
  };
  for (let x = 0; x < width; x++) {
    const gap = colIsGap(x);
    if (!gap && runStart < 0) runStart = x;
    else if (gap && runStart >= 0) closeRun(x);
  }
  closeRun(width);

  const order = swatches.map((s) => s.hex);
  // `top` came from real gap/strip geometry (white-margin, then non-white rows, then a
  // white gap) — crop on that regardless of how clean `swatches` came out, so a legend strip
  // that's hard to read colour-by-colour (noisy photo, label text crossing every swatch)
  // still gets cut off the design image rather than leaving it in because of this alone
  // (2026-10-01: that exact failure mode, `order.length < 2` returning null here, undid
  // the crop entirely for a real DnD visualization JPEG).
  return { top, stripTop, stripBottom, order, swatches };
}

// Below this luminance, a pixel is the printed code's ink, not the swatch's own colour —
// a real swatch chip here turned out to be a small photographed fabric sample (visible grain,
// shading), not a flat fill, so a plain average is closer to the true yarn colour than a
// most-common-exact-hex mode (which just found noise). Excluding the near-black text keeps
// that average from being dragged toward black by the handful of ink pixels in the crop.
const TEXT_INK_LUMA = 60;

/**
 * Mean colour within a rectangle, excluding pixels dark enough to be the printed code's ink
 * rather than the swatch's own (possibly textured) colour.
 */
function averageRectColour(image: BmpImage, x0: number, x1: number, y0: number, y1: number): string {
  const { width, rgb } = image;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * width + x) * 3;
      const pr = rgb[p]!;
      const pg = rgb[p + 1]!;
      const pb = rgb[p + 2]!;
      if (0.299 * pr + 0.587 * pg + 0.114 * pb < TEXT_INK_LUMA) continue;
      r += pr;
      g += pg;
      b += pb;
      count++;
    }
  }
  if (count === 0) return "FFFFFF";
  return toHex(Math.round(r / count), Math.round(g / count), Math.round(b / count));
}

/** Perceived luminance for picking readable label text over a swatch. */
export function isLightColour(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
