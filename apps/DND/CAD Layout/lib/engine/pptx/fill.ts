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
import { TEMPLATES, type TemplateSpec } from "./templates";
import {
  appendShapeText,
  findShapeById,
  fitInside,
  getFrame,
  maxShapeId,
  removeShape,
  setFrame,
  setPictureImage,
  setShapeId,
  setShapeLines,
  setShapeText,
  setSolidFill,
  setTextColour,
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
    await fillOptionSlide(pkg, doc, slidePath, template, input.spec, option, warnings);
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
  warnings: string[],
): Promise<void> {
  const shape = (id: number): XElement => {
    const el = findShapeById(doc, id);
    if (!el) throw new Error(`template ${template.file}: shape id ${id} not found on ${slidePath}`);
    return el;
  };

  // Spec fields --------------------------------------------------------------
  for (const [key, target] of Object.entries(template.fields)) {
    if (!target) continue;
    const value = key === "designCode" ? option.designCode : spec[key as keyof LayoutSpec];
    const el = shape(target.id);
    const text = (value ?? "").trim();
    if (target.mode === "append") {
      appendShapeText(el, text);
      if (text && target.widthEmu) setFrame(el, { ...getFrame(el), cx: target.widthEmu });
    } else if (target.mode === "template") {
      if (text) setShapeText(el, target.template!(text));
    } else if (text || key === "designCode") {
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
  setPictureImage(shape(template.designPicId), designRId, bmp.width, designHeight);

  // Colour slots -------------------------------------------------------------
  const slots = template.colourSlotIds;
  if (option.colours.length > slots.length) {
    warnings.push(
      `${option.designCode || "design option"}: ${option.colours.length} colours but the ${template.file} layout has ${slots.length} slots — the smallest ${option.colours.length - slots.length} were left off.`,
    );
  }
  slots.forEach((id, idx) => {
    const el = shape(id);
    const colour = option.colours[idx];
    if (!colour) {
      removeShape(el);
      return;
    }
    setSolidFill(el, colour.hex);
    setShapeText(el, template.slotText(idx + 1, colour.code.trim(), colour.yarn?.trim() || undefined));
    setTextColour(el, isLightColour(colour.hex) ? "262626" : "FFFFFF");
  });
  for (const id of template.staleShapeIds) {
    const el = findShapeById(doc, id);
    if (el) removeShape(el);
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

function normaliseExt(ext: string, detected?: string): string {
  const e = (detected || ext).toLowerCase().replace(/^\./, "");
  return e === "jpeg" ? "jpg" : e;
}
