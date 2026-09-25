// Fills a DnD template deck: one slide per design option (cloned from the template's
// option slide), the fixed terms slide left untouched at the end. Only the shapes listed
// in templates.ts are edited.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { imageSize } from "image-size";
import { parseBmp } from "../bmp";
import { analyseTikni, isLightColour } from "../palette";
import { encodePng } from "../png";
import type { DesignOptionInput, LayoutSpec, LayoutVariant } from "../spec";
import { PptxPackage } from "./package";
import { TEMPLATES, type DimensionShape, type SwatchShapes, type TemplateSpec } from "./templates";
import {
  type Box,
  appendShapeText,
  findShapeById,
  fitInside,
  getFrame,
  maxShapeId,
  removeShape,
  scaleTextSize,
  setFrame,
  setPictureImage,
  setShapeId,
  setShapeLines,
  setShapeText,
  setSolidFill,
  setTextColour,
  setVerticalInsets,
  type XDocument,
  type XElement,
} from "./xml";

export interface ReferenceImage {
  data: Uint8Array;
  /** File extension without the dot — png, jpg, jpeg, gif, bmp, webp, tiff. */
  ext: string;
}

export interface DesignOptionFiles extends DesignOptionInput {
  bmp: Uint8Array;
  references: ReferenceImage[];
  /** The manually cut swatch (DnD demo 2026-09-19). Omitted => the slot is removed. */
  swatch?: ReferenceImage;
}

export interface GenerateDeckInput {
  variant: LayoutVariant;
  spec: LayoutSpec;
  options: DesignOptionFiles[];
}

export interface GenerateDeckResult {
  pptx: Buffer;
  warnings: string[];
}

export async function generateDeck(input: GenerateDeckInput, templatesDir: string): Promise<GenerateDeckResult> {
  if (input.options.length === 0) throw new Error("at least one design option is required");
  const template = TEMPLATES[input.variant];
  const warnings: string[] = [];

  const pkg = await PptxPackage.load(await readFile(path.join(templatesDir, template.file)));
  const slides = await pkg.slidePaths();
  const optionSlide = slides[template.optionSlideIndex];
  if (!optionSlide) throw new Error(`template ${template.file} has no slide ${template.optionSlideIndex}`);

  for (const idx of template.removeSlideIndexes) {
    const p = slides[idx];
    if (p) await pkg.removeSlide(p);
  }

  const optionSlides: string[] = [optionSlide];
  for (let i = 1; i < input.options.length; i++) {
    optionSlides.push(await pkg.cloneSlide(optionSlides[i - 1]!));
  }

  for (let i = 0; i < input.options.length; i++) {
    const option = input.options[i]!;
    const slidePath = optionSlides[i]!;
    const doc = await pkg.xml(slidePath);
    await fillOptionSlide(pkg, doc, slidePath, template, input.spec, option, i, input.options.length, warnings);
  }

  return { pptx: await pkg.save(), warnings };
}

async function fillOptionSlide(
  pkg: PptxPackage,
  doc: XDocument,
  slidePath: string,
  template: TemplateSpec,
  spec: LayoutSpec,
  option: DesignOptionFiles,
  optionIndex: number,
  optionCount: number,
  warnings: string[],
): Promise<void> {
  const shape = (id: number): XElement => {
    const el = findShapeById(doc, id);
    if (!el) throw new Error(`template ${template.file}: shape id ${id} not found on ${slidePath}`);
    return el;
  };

  // Spec fields --------------------------------------------------------------
  // Every mapped shape is written even when its value is blank: the templates are real
  // past jobs, so leaving a field untouched would publish that job's data (customer name,
  // PD number) in someone else's layout.
  for (const [key, target] of Object.entries(template.fields)) {
    if (!target) continue;
    const el = shape(target.id);
    if (target.mode === "compose") {
      const composed = target.compose!({ spec, option, optionIndex, optionCount });
      setShapeLines(el, Array.isArray(composed) ? composed : [composed]);
      continue;
    }
    const value = key === "designCode" ? option.designCode : spec[key as keyof LayoutSpec];
    const text = (value ?? "").trim();
    if (target.mode === "append") {
      appendShapeText(el, text);
      if (text && target.widthEmu) setFrame(el, { ...getFrame(el), cx: target.widthEmu });
    } else if (target.mode === "template") {
      setShapeText(el, text ? target.template!(text) : "");
    } else {
      setShapeText(el, text);
    }
  }
  setShapeLines(
    shape(template.specValuesId),
    template.specRows.map((row) => `${template.specRowPrefix}${(spec[row] ?? "").trim()}`),
  );

  // Design image (BMP -> PNG, legend strip cropped, never the BMP itself) -----
  const bmp = parseBmp(option.bmp);
  const { designHeight } = analyseTikni(bmp);
  const png = encodePng(bmp.width, designHeight, bmp.rgb.subarray(0, designHeight * bmp.width * 3));
  const designRId = await pkg.addImage(slidePath, png, "png");
  const designPic = shape(template.designPicId);
  const designFrame = getFrame(designPic);
  setPictureImage(designPic, designRId, bmp.width, designHeight);
  const fitted = getFrame(designPic);
  for (const dim of template.dimensionShapes) {
    hugImage(shape(dim.id), dim, designFrame, fitted);
  }

  // Colour slots -------------------------------------------------------------
  fillColourSlots(doc, shape, template, option, warnings);
  for (const id of template.staleShapeIds) {
    const el = findShapeById(doc, id);
    if (el) removeShape(el);
  }

  // Swatch -------------------------------------------------------------------
  if (template.swatch) {
    const { picId, dimensionGroupId, sizeLabelIds } = template.swatch;
    if (option.swatch) {
      const dims = imageSize(option.swatch.data);
      if (dims.width && dims.height) {
        const rId = await pkg.addImage(slidePath, option.swatch.data, normaliseExt(option.swatch.ext, dims.type));
        setPictureImage(shape(picId), rId, dims.width, dims.height);
      } else {
        warnings.push(`${option.designCode || "design option"}: the swatch image could not be read and was skipped.`);
        removeSwatch(doc, template.swatch);
      }
      const size = (option.swatchSize ?? "").trim();
      for (const id of sizeLabelIds) {
        const el = findShapeById(doc, id);
        if (el) setShapeText(el, size);
      }
    } else {
      // No swatch supplied — drop the template job's own swatch, its arrows and captions.
      removeSwatch(doc, template.swatch);
      void dimensionGroupId;
    }
  }

  // Reference / design-intent images -----------------------------------------
  const refPic = shape(template.referencePicId);
  if (option.references.length === 0) {
    removeShape(refPic);
    return;
  }
  const frame = getFrame(refPic);
  const cols = Math.ceil(Math.sqrt(option.references.length));
  const rows = Math.ceil(option.references.length / cols);
  const gap = Math.round(frame.cx * 0.02);
  const cellW = (frame.cx - gap * (cols - 1)) / cols;
  const cellH = (frame.cy - gap * (rows - 1)) / rows;
  let nextId = maxShapeId(doc) + 1;

  for (let i = 0; i < option.references.length; i++) {
    const ref = option.references[i]!;
    const dims = imageSize(ref.data);
    if (!dims.width || !dims.height) {
      warnings.push(`${option.designCode || "design option"}: reference image ${i + 1} could not be read and was skipped.`);
      continue;
    }
    const rId = await pkg.addImage(slidePath, ref.data, normaliseExt(ref.ext, dims.type));
    const cell = {
      x: frame.x + (i % cols) * (cellW + gap),
      y: frame.y + Math.floor(i / cols) * (cellH + gap),
      cx: cellW,
      cy: cellH,
    };
    let pic = refPic;
    if (i > 0) {
      pic = refPic.cloneNode(true) as XElement;
      setShapeId(pic, nextId++);
      refPic.parentNode!.insertBefore(pic, refPic.nextSibling);
    }
    setPictureImage(pic, rId, dims.width, dims.height, fitInside(cell, dims.width, dims.height));
  }
}

function removeSwatch(doc: XDocument, swatch: SwatchShapes): void {
  for (const id of [swatch.picId, swatch.dimensionGroupId, ...swatch.sizeLabelIds]) {
    const el = findShapeById(doc, id);
    if (el) removeShape(el);
  }
}

/**
 * Writes the numbered colour column, cloning the template's last slot when a design has
 * more colours than the source job did, and tightening the pitch so the column still
 * ends above the band's bottom (see ColourSlots in templates.ts).
 */
function fillColourSlots(
  doc: XDocument,
  shape: (id: number) => XElement,
  template: TemplateSpec,
  option: DesignOptionFiles,
  warnings: string[],
): void {
  const { ids, bandBottomEmu } = template.colourSlots;
  const count = option.colours.length;
  const elements: XElement[] = ids.map(shape);

  if (count < ids.length) {
    for (const el of elements.slice(count)) removeShape(el);
    elements.length = count;
  }

  const first = getFrame(elements[0]!);
  const second = ids.length > 1 ? getFrame(elements[1] ?? shape(ids[1]!)) : null;
  const nativePitch = second ? second.y - first.y : first.cy * 1.15;

  if (count > ids.length) {
    let nextId = maxShapeId(doc) + 1;
    const last = elements[elements.length - 1]!;
    for (let i = ids.length; i < count; i++) {
      const clone = last.cloneNode(true) as XElement;
      setShapeId(clone, nextId++);
      last.parentNode!.insertBefore(clone, last.nextSibling);
      elements.push(clone);
    }
  }

  // Squeeze only if the natural pitch would overflow the band. When squeezed, the boxes
  // and their text shrink with the pitch so rows don't overlap.
  const available = bandBottomEmu - first.y - first.cy;
  const pitch = count > 1 ? Math.min(nativePitch, available / (count - 1)) : nativePitch;
  const squeeze = Math.min(1, pitch / nativePitch);
  // Exactly the pitch when squeezed, so consecutive boxes touch instead of overlapping.
  const height = Math.round(Math.min(first.cy, pitch));
  if (squeeze < 0.85) {
    warnings.push(
      `${option.designCode || "design option"}: ${count} colours is more than the ${template.file} layout is built for — the colour list is compressed to fit.`,
    );
  }

  elements.forEach((el, idx) => {
    const colour = option.colours[idx]!;
    setFrame(el, { x: first.x, y: Math.round(first.y + pitch * idx), cx: first.cx, cy: height });
    setSolidFill(el, colour.hex);
    setShapeText(el, template.slotText(idx + 1, colour.code.trim(), colour.yarn?.trim() || undefined));
    setTextColour(el, isLightColour(colour.hex) ? "262626" : "FFFFFF");
    if (squeeze < 1) {
      scaleTextSize(el, squeeze);
      setVerticalInsets(el, 0, 0);
    }
  });
}

/**
 * Moves a dimension arrow/label so it keeps the same margin from the fitted image's edge
 * that it had from the template's picture frame (see DimensionShape in templates.ts).
 */
function hugImage(el: XElement, dim: DimensionShape, frame: Box, img: Box): void {
  const box = getFrame(el);
  const next: Box = { ...box };
  const trackX = dim.anchor === "bottom" || dim.anchor === "both";
  const trackY = dim.anchor === "right" || dim.anchor === "both";

  if (trackX) {
    if (dim.mode === "stretch") {
      next.x = img.x + (box.x - frame.x);
      next.cx = img.cx + (box.cx - frame.cx);
    } else {
      // Keep the label's offset from the frame centre (the JLI template deliberately sets
      // "Width :" right of centre so it clears the spec table below the image).
      const centreOffset = box.x + box.cx / 2 - (frame.x + frame.cx / 2);
      next.x = img.x + img.cx / 2 + centreOffset - box.cx / 2;
    }
  }
  if (trackY) {
    if (dim.mode === "stretch") {
      next.y = img.y + (box.y - frame.y);
      next.cy = img.cy + (box.cy - frame.cy);
    } else {
      const centreOffset = box.y + box.cy / 2 - (frame.y + frame.cy / 2);
      next.y = img.y + img.cy / 2 + centreOffset - box.cy / 2;
    }
  }
  // Offset from the edge the shape sits beside.
  if (dim.anchor === "bottom") next.y = img.y + img.cy + (box.y - (frame.y + frame.cy));
  if (dim.anchor === "right") next.x = img.x + img.cx + (box.x - (frame.x + frame.cx));

  setFrame(el, next);
}

function normaliseExt(ext: string, detected?: string): string {
  const e = (detected || ext).toLowerCase().replace(/^\./, "");
  return e === "jpeg" ? "jpg" : e;
}
