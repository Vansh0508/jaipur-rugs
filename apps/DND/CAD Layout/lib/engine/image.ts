// Entry point for "whatever design file DnD actually has", not just a Tikni BMP. Real
// jobs arrive as BMP, PNG or JPG (Sudesh Sharma, 2026-09-28: "sare option open ker do
// like galicha file jpg png" — enable jpg/png the same as the rug file). BMP stays the
// best case (parseBmp keeps its real indexed palette, so colour counts are exact); PNG
// and JPG are continuous-tone or re-compressed, so their pixels are quantized down to a
// manageable set of dominant colours instead of being counted one-hex-per-pixel.

import { Buffer } from "node:buffer";
import { imageSize } from "image-size";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { parseBmp, toHex, type BmpImage } from "./bmp";

export type DesignImage = BmpImage;

const MAX_QUANTIZED_COLOURS = 40;
// Round each channel to a multiple of this before counting — collapses JPEG artifacting
// and anti-aliasing gradients into the same bucket as the colour they're a shade of.
const QUANT_STEP = 16;
// Euclidean RGB distance below which two bucketed colours are merged into one (see
// mergeSimilarBuckets). A real DnD photo of a near-monochrome rug (2026-10-01,
// "QNQ-66-02 (Visualization)(1).jpg") produced 40 colours that were, to the eye, maybe
// 8 real ones — lighting and fabric-texture gradients spread one colour across dozens of
// QUANT_STEP buckets that independent per-channel rounding never put back together. A
// photographer's studio lighting gradient across one yarn colour moves each channel by
// comparable, correlated amounts, so Euclidean distance (not a wider QUANT_STEP, which
// would just as easily merge genuinely different pale colours) is what actually matches
// "same colour, different shading" rather than "different colour, similar brightness."
const MERGE_DISTANCE = 30;
// Matches the dimension guard bmp.ts already applies to BMPs — one real DnD reference
// photo (2026-09-28: "20250428 NEXUS ID - COWORKING LOUNGE.jpg") is a genuine 8000x4500,
// 36 megapixel camera shot, so this has real headroom above real files, not just BMPs.
const MAX_PIXELS = 80_000_000;
// jpeg-js's internal decode buffers run well above the final RGBA size — that 36MP file
// (144MB as RGBA) needed over 512MB and threw "maxMemoryUsageInMB limit exceeded" before
// this was raised. Generous on purpose; MAX_PIXELS above is the real backstop.
const JPEG_DECODE_MEMORY_MB = 2048;

export function parseDesignImage(buf: Uint8Array): DesignImage {
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return parseBmp(buf);
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    checkDimensions(buf);
    const png = PNG.sync.read(Buffer.from(buf));
    const rgb = rgbFromRgba(png.data, png.width, png.height);
    return { width: png.width, height: png.height, rgb, colourCounts: countColours(rgb), indexed: false };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    checkDimensions(buf);
    const decoded = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: JPEG_DECODE_MEMORY_MB });
    const rgb = rgbFromRgba(decoded.data, decoded.width, decoded.height);
    return { width: decoded.width, height: decoded.height, rgb, colourCounts: countColours(rgb), indexed: false };
  }
  throw new Error("Unsupported file type — upload a BMP, PNG or JPG design file");
}

/** Cheap header-only read, before the full (memory-heavy) decode. */
function checkDimensions(buf: Uint8Array): void {
  const dims = imageSize(buf);
  if (dims.width && dims.height && dims.width * dims.height > MAX_PIXELS) {
    throw new Error(`Image is too large (${dims.width}x${dims.height}) — resize it before uploading.`);
  }
}

function rgbFromRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    rgb[i * 3] = rgba[p]!;
    rgb[i * 3 + 1] = rgba[p + 1]!;
    rgb[i * 3 + 2] = rgba[p + 2]!;
  }
  return rgb;
}

/**
 * Counts exact colours first — a flat-colour PNG (a screenshot of a swatch strip, say)
 * needs no quantization and this keeps it exact. Only falls back to bucketed dominant
 * colours once the exact count is large enough that it's clearly a photo/render, where
 * per-pixel-exact counting would return thousands of near-duplicate shades instead of the
 * handful DnD would call a color.
 *
 * Exported so palette.ts's analyseTikni can count colours the same way over its
 * legend-stripped crop of the design, instead of doing its own always-exact per-pixel
 * scan — that duplicate path is what let a real 8000x4500 JPEG (2026-09-28) reach the
 * app as a "299,022-colour palette", silently ignoring this quantization entirely.
 */
export function countColours(rgb: Uint8Array): Map<string, number> {
  const exact = new Map<string, number>();
  let clearlyContinuousTone = false;
  for (let p = 0; p < rgb.length; p += 3) {
    const hex = toHex(rgb[p]!, rgb[p + 1]!, rgb[p + 2]!);
    exact.set(hex, (exact.get(hex) ?? 0) + 1);
    if (exact.size > MAX_QUANTIZED_COLOURS * 4) {
      clearlyContinuousTone = true;
      break; // stop scanning exact colours early and quantize instead
    }
  }
  if (!clearlyContinuousTone) {
    return exact;
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let p = 0; p < rgb.length; p += 3) {
    const r = rgb[p]!;
    const g = rgb[p + 1]!;
    const b = rgb[p + 2]!;
    // Round to the nearest multiple of QUANT_STEP, clamped to a byte — rounding 255 up
    // would otherwise overflow to 256, which toHex would render as a 3-digit hex chunk.
    const key = toHex(quantiseChannel(r), quantiseChannel(g), quantiseChannel(b));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const top = mergeSimilarBuckets([...buckets.values()]).slice(0, MAX_QUANTIZED_COLOURS);
  const colourCounts = new Map<string, number>();
  for (const bucket of top) {
    // Average colour actually seen in the bucket, not the rounded bucket key — keeps the
    // reported hex a real colour from the image rather than a quantization artifact.
    const hex = toHex(Math.round(bucket.r / bucket.count), Math.round(bucket.g / bucket.count), Math.round(bucket.b / bucket.count));
    colourCounts.set(hex, (colourCounts.get(hex) ?? 0) + bucket.count);
  }
  return colourCounts;
}

function quantiseChannel(value: number): number {
  return Math.min(255, Math.round(value / QUANT_STEP) * QUANT_STEP);
}

interface ColourBucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Greedy single-link clustering by RGB distance between accumulated-mean centroids,
 * largest bucket first (so a dominant colour's many nearby shading buckets all merge into
 * it, rather than two small buckets merging into each other and crowding out the real
 * dominant colour). Returned sorted by total pixel count, descending.
 */
function mergeSimilarBuckets(buckets: ColourBucket[]): ColourBucket[] {
  const sorted = [...buckets].sort((a, b) => b.count - a.count);
  const clusters: ColourBucket[] = [];
  for (const bucket of sorted) {
    const target = clusters.find((c) => rgbDistance(c, bucket) <= MERGE_DISTANCE);
    if (target) {
      target.count += bucket.count;
      target.r += bucket.r;
      target.g += bucket.g;
      target.b += bucket.b;
    } else {
      clusters.push({ ...bucket });
    }
  }
  return clusters.sort((a, b) => b.count - a.count);
}

function rgbDistance(a: ColourBucket, b: ColourBucket): number {
  const dr = a.r / a.count - b.r / b.count;
  const dg = a.g / a.count - b.g / b.count;
  const db = a.b / a.count - b.b / b.count;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
