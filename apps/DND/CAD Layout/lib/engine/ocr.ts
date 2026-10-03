// Reads the code printed on each legend swatch (e.g. "M12") and, when confident, writes it
// onto the matching PaletteColour as `tikniCode` — DnD confirmed (Ritika Singh, 2026-10-02:
// "yes") these are real colour codes the designer wants pre-filled into the GRC/ARS code box,
// not just Tikni-internal bookkeeping.
//
// A wrong auto-filled code is a production-correctness risk (wrong yarn code on an approved
// layout), not just a cosmetic miss, so this only ever fills a code it's actually confident
// about (MIN_CONFIDENCE, CODE_PATTERN) and otherwise leaves the field blank for the designer
// to type — per the explicit 2026-10-02 decision not to guess at a low-confidence read.

import { createWorker, type Worker } from "tesseract.js";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { BmpImage } from "./bmp";
import type { LegendSwatch, TikniAnalysis } from "./palette";
import { encodePng } from "./png";

const MIN_CONFIDENCE = 60;
// Tikni/vis-software codes seen so far: "M12", "ARS-102", "GRC-04" — short, upper-case,
// alphanumeric, optionally hyphenated. Anything OCR returns outside this shape is more
// likely noise (a stray mark, part of the swatch border) than a real code.
const CODE_PATTERN = /^[A-Z0-9]{1,4}-?[A-Z0-9]{0,4}$/;
// Small swatch crops OCR poorly; upscale before recognizing.
const MIN_OCR_HEIGHT = 120;
const CROP_MARGIN = 2;

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    const cachePath = path.join(process.cwd(), ".cache", "tesseract");
    workerPromise = mkdir(cachePath, { recursive: true }).then(() => createWorker("eng", undefined, { cachePath }));
  }
  return workerPromise;
}

/** Mutates `analysis.byArea[*].tikniCode` in place for every confidently-read swatch. */
export async function readTikniCodes(image: BmpImage, analysis: TikniAnalysis): Promise<void> {
  const legend = analysis.legend;
  if (!legend || legend.swatches.length === 0) return;

  const worker = await getWorker().catch(() => null);
  if (!worker) return; // OCR unavailable (e.g. no network for the first-run language data) — leave codes blank, not broken.

  for (const swatch of legend.swatches) {
    if (!swatch.matchedHex) continue;
    try {
      const code = await recognizeSwatchCode(worker, image, legend.stripTop, legend.stripBottom, swatch);
      if (!code) continue;
      const colour = analysis.byArea.find((c) => c.hex === swatch.matchedHex);
      if (colour) colour.tikniCode = code;
    } catch {
      // One unreadable swatch shouldn't block the rest, or the palette response itself.
    }
  }
}

async function recognizeSwatchCode(worker: Worker, image: BmpImage, stripTop: number, stripBottom: number, swatch: LegendSwatch): Promise<string | null> {
  const { width, height, rgb } = image;
  const x0 = Math.max(0, swatch.xStart - CROP_MARGIN);
  const x1 = Math.min(width, swatch.xEnd + CROP_MARGIN);
  const y0 = Math.max(0, stripTop - CROP_MARGIN);
  const y1 = Math.min(height, stripBottom + 1 + CROP_MARGIN);
  const cropW = x1 - x0;
  const cropH = y1 - y0;
  if (cropW < 2 || cropH < 2) return null;

  const scale = Math.max(1, Math.ceil(MIN_OCR_HEIGHT / cropH));
  const outW = cropW * scale;
  const outH = cropH * scale;
  const out = new Uint8Array(outW * outH * 3);
  for (let y = 0; y < outH; y++) {
    const sy = y0 + Math.floor(y / scale);
    for (let x = 0; x < outW; x++) {
      const sx = x0 + Math.floor(x / scale);
      const sp = (sy * width + sx) * 3;
      const dp = (y * outW + x) * 3;
      out[dp] = rgb[sp]!;
      out[dp + 1] = rgb[sp + 1]!;
      out[dp + 2] = rgb[sp + 2]!;
    }
  }

  const png = encodePng(outW, outH, out);
  const { data } = await worker.recognize(png);
  const text = data.text.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!text || data.confidence < MIN_CONFIDENCE || !CODE_PATTERN.test(text)) return null;
  return text;
}
