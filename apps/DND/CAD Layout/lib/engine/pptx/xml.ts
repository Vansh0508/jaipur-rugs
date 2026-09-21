// Shape-level edits on a slide's DrawingML. Everything here mutates an existing shape in
// place and leaves the rest of the slide untouched — the template's fixed text, address
// block, disclaimers and approval boxes must survive byte-for-byte (PRD Section 8.1).

import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

export const NS = {
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types",
} as const;

type XDocument = ReturnType<DOMParser["parseFromString"]>;
type XElement = NonNullable<XDocument["documentElement"]>;
export type { XDocument, XElement };

export function parseXml(xml: string): XDocument {
  return new DOMParser().parseFromString(xml, "application/xml");
}

export function serializeXml(doc: XDocument): string {
  return new XMLSerializer().serializeToString(doc);
}

export function childElements(el: XElement, ns?: string, local?: string): XElement[] {
  const out: XElement[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i] as XElement;
    if (n.nodeType !== 1) continue;
    if (ns && n.namespaceURI !== ns) continue;
    if (local && n.localName !== local) continue;
    out.push(n);
  }
  return out;
}

export function firstDescendant(el: XElement, ns: string, local: string): XElement | null {
  return (el.getElementsByTagNameNS(ns, local)[0] as XElement | undefined) ?? null;
}

/** The `p:sp` / `p:pic` / `p:grpSp` whose non-visual properties carry this `cNvPr` id. */
export function findShapeById(doc: XDocument, id: number): XElement | null {
  const props = doc.getElementsByTagNameNS(NS.p, "cNvPr");
  for (let i = 0; i < props.length; i++) {
    const el = props[i] as XElement;
    if (Number(el.getAttribute("id")) === id) {
      return el.parentNode!.parentNode as XElement;
    }
  }
  return null;
}

export function maxShapeId(doc: XDocument): number {
  let max = 0;
  const props = doc.getElementsByTagNameNS(NS.p, "cNvPr");
  for (let i = 0; i < props.length; i++) {
    max = Math.max(max, Number((props[i] as XElement).getAttribute("id")) || 0);
  }
  return max;
}

export function removeShape(shape: XElement): void {
  shape.parentNode?.removeChild(shape);
}

export function getShapeText(shape: XElement): string {
  const body = firstDescendant(shape, NS.p, "txBody");
  if (!body) return "";
  return childElements(body, NS.a, "p")
    .map((p) => childElements(p, NS.a, "r").map((r) => firstDescendant(r, NS.a, "t")?.textContent ?? "").join(""))
    .join("\n");
}

/**
 * Replaces a shape's whole text with one paragraph per line, cloning the first paragraph's
 * `pPr` and first run's `rPr` so font, size, colour and superscript-baseline all carry over.
 */
export function setShapeLines(shape: XElement, lines: string[]): void {
  const body = firstDescendant(shape, NS.p, "txBody");
  if (!body) throw new Error(`shape ${describe(shape)} has no txBody`);
  const paragraphs = childElements(body, NS.a, "p");
  const proto = paragraphs[0];
  if (!proto) throw new Error(`shape ${describe(shape)} has no paragraph to clone`);
  const doc = shape.ownerDocument!;

  const pPr = childElements(proto, NS.a, "pPr")[0];
  const firstRun = childElements(proto, NS.a, "r")[0];
  const rPrSource = firstRun ? childElements(firstRun, NS.a, "rPr")[0] : childElements(proto, NS.a, "endParaRPr")[0];

  for (const p of paragraphs) body.removeChild(p);

  for (const line of lines) {
    const p = doc.createElementNS(NS.a, "a:p");
    if (pPr) p.appendChild(pPr.cloneNode(true));
    const r = doc.createElementNS(NS.a, "a:r");
    if (rPrSource) {
      const rPr = rPrSource.cloneNode(true) as XElement;
      // endParaRPr and rPr share a schema; only the element name differs.
      if (rPr.localName !== "rPr") {
        const renamed = doc.createElementNS(NS.a, "a:rPr");
        for (let i = 0; i < rPr.attributes.length; i++) {
          const attr = rPr.attributes[i]!;
          renamed.setAttribute(attr.name, attr.value);
        }
        while (rPr.firstChild) renamed.appendChild(rPr.firstChild);
        r.appendChild(renamed);
      } else {
        r.appendChild(rPr);
      }
    }
    const t = doc.createElementNS(NS.a, "a:t");
    t.appendChild(doc.createTextNode(line));
    r.appendChild(t);
    p.appendChild(r);
    body.appendChild(p);
  }
}

export function setShapeText(shape: XElement, text: string): void {
  setShapeLines(shape, [text]);
}

/** Appends `text` as a new run after the existing first-paragraph runs (label + value). */
export function appendShapeText(shape: XElement, text: string): void {
  if (!text) return;
  const body = firstDescendant(shape, NS.p, "txBody");
  const p = body ? childElements(body, NS.a, "p")[0] : undefined;
  if (!p) throw new Error(`shape ${describe(shape)} has no paragraph to append to`);
  const runs = childElements(p, NS.a, "r");
  const last = runs[runs.length - 1];
  if (!last) {
    setShapeText(shape, text);
    return;
  }
  const clone = last.cloneNode(true) as XElement;
  const t = firstDescendant(clone, NS.a, "t")!;
  while (t.firstChild) t.removeChild(t.firstChild);
  t.appendChild(shape.ownerDocument!.createTextNode(text));
  const endParaRPr = childElements(p, NS.a, "endParaRPr")[0];
  if (endParaRPr) p.insertBefore(clone, endParaRPr);
  else p.appendChild(clone);
}

/** `<a:solidFill><a:srgbClr val="RRGGBB"/></a:solidFill>` on the shape's own `spPr`. */
export function setSolidFill(shape: XElement, hex: string): void {
  const spPr = childElements(shape, NS.p, "spPr")[0];
  if (!spPr) throw new Error(`shape ${describe(shape)} has no spPr`);
  const doc = shape.ownerDocument!;
  for (const fill of childElements(spPr).filter((c) => /^(noFill|solidFill|gradFill|blipFill|pattFill|grpFill)$/.test(c.localName!))) {
    spPr.removeChild(fill);
  }
  const solid = doc.createElementNS(NS.a, "a:solidFill");
  const clr = doc.createElementNS(NS.a, "a:srgbClr");
  clr.setAttribute("val", hex.toUpperCase());
  solid.appendChild(clr);
  // spPr child order per schema: xfrm, geometry, fill, ln, effects...
  const ln = childElements(spPr, NS.a, "ln")[0];
  if (ln) spPr.insertBefore(solid, ln);
  else spPr.appendChild(solid);
}

/**
 * Multiplies every run's font size by `factor`. Used when the colour column is squeezed to
 * fit more colours than the template was built for — without this the 17pt runs overflow
 * their shortened boxes and overlap each other.
 */
export function scaleTextSize(shape: XElement, factor: number, minHundredths = 700): void {
  const body = firstDescendant(shape, NS.p, "txBody");
  if (!body) return;
  for (const local of ["rPr", "endParaRPr", "defRPr"]) {
    const list = body.getElementsByTagNameNS(NS.a, local);
    for (let i = 0; i < list.length; i++) {
      const rPr = list[i] as XElement;
      const current = Number(rPr.getAttribute("sz"));
      if (!current) continue;
      rPr.setAttribute("sz", String(Math.max(minHundredths, Math.round(current * factor))));
    }
  }
}

/** Sets the text frame's top/bottom insets (EMU) — used to reclaim padding in squeezed boxes. */
export function setVerticalInsets(shape: XElement, topEmu: number, bottomEmu: number): void {
  const body = firstDescendant(shape, NS.p, "txBody");
  const bodyPr = body ? childElements(body, NS.a, "bodyPr")[0] : undefined;
  if (!bodyPr) return;
  bodyPr.setAttribute("tIns", String(topEmu));
  bodyPr.setAttribute("bIns", String(bottomEmu));
  // spAutoFit would grow the box straight back to fit the text.
  for (const fit of childElements(bodyPr).filter((c) => c.localName === "spAutoFit")) bodyPr.removeChild(fit);
}

/** Forces every run (and end-of-paragraph marker) in the shape to one text colour. */
export function setTextColour(shape: XElement, hex: string): void {
  const doc = shape.ownerDocument!;
  const body = firstDescendant(shape, NS.p, "txBody");
  if (!body) return;
  const targets: XElement[] = [];
  for (const local of ["rPr", "endParaRPr"]) {
    const list = body.getElementsByTagNameNS(NS.a, local);
    for (let i = 0; i < list.length; i++) targets.push(list[i] as XElement);
  }
  for (const rPr of targets) {
    for (const fill of childElements(rPr).filter((c) => /^(noFill|solidFill|gradFill)$/.test(c.localName!))) {
      rPr.removeChild(fill);
    }
    const solid = doc.createElementNS(NS.a, "a:solidFill");
    const clr = doc.createElementNS(NS.a, "a:srgbClr");
    clr.setAttribute("val", hex.toUpperCase());
    solid.appendChild(clr);
    // rPr child order: ln, fill, effect, highlight, uLnTx/uLn, uFillTx/uFill, latin, ea, cs...
    const anchor = childElements(rPr).find((c) => c.localName !== "ln");
    if (anchor) rPr.insertBefore(solid, anchor);
    else rPr.appendChild(solid);
  }
}

export interface Box {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

export function getFrame(shape: XElement): Box {
  const xfrm = firstDescendant(shape, NS.a, "xfrm");
  const off = xfrm ? childElements(xfrm, NS.a, "off")[0] : undefined;
  const ext = xfrm ? childElements(xfrm, NS.a, "ext")[0] : undefined;
  if (!off || !ext) throw new Error(`shape ${describe(shape)} has no xfrm`);
  return {
    x: Number(off.getAttribute("x")),
    y: Number(off.getAttribute("y")),
    cx: Number(ext.getAttribute("cx")),
    cy: Number(ext.getAttribute("cy")),
  };
}

export function setFrame(shape: XElement, box: Box): void {
  const xfrm = firstDescendant(shape, NS.a, "xfrm")!;
  const off = childElements(xfrm, NS.a, "off")[0]!;
  const ext = childElements(xfrm, NS.a, "ext")[0]!;
  off.setAttribute("x", String(Math.round(box.x)));
  off.setAttribute("y", String(Math.round(box.y)));
  ext.setAttribute("cx", String(Math.round(box.cx)));
  ext.setAttribute("cy", String(Math.round(box.cy)));
}

/** Largest box with the image's aspect ratio that fits inside `frame`, centred. */
export function fitInside(frame: Box, imgW: number, imgH: number): Box {
  const scale = Math.min(frame.cx / imgW, frame.cy / imgH);
  const cx = imgW * scale;
  const cy = imgH * scale;
  return { x: frame.x + (frame.cx - cx) / 2, y: frame.y + (frame.cy - cy) / 2, cx, cy };
}

/**
 * Points a `p:pic` at a new image relationship and drops any crop the template author
 * applied to the placeholder photo (a `srcRect` tuned for the old image would clip ours).
 */
export function setPictureImage(pic: XElement, rId: string, imgW: number, imgH: number, frame: Box = getFrame(pic)): void {
  const blipFill = firstDescendant(pic, NS.p, "blipFill");
  if (!blipFill) throw new Error(`shape ${describe(pic)} is not a picture`);
  const blip = childElements(blipFill, NS.a, "blip")[0];
  if (!blip) throw new Error(`picture ${describe(pic)} has no blip`);
  blip.setAttributeNS(NS.r, "r:embed", rId);
  for (const src of childElements(blipFill, NS.a, "srcRect")) blipFill.removeChild(src);
  setFrame(pic, fitInside(frame, imgW, imgH));
}

export function setShapeId(shape: XElement, id: number): void {
  const cNvPr = firstDescendant(shape, NS.p, "cNvPr");
  if (!cNvPr) return;
  cNvPr.setAttribute("id", String(id));
  cNvPr.setAttribute("name", `${cNvPr.getAttribute("name") ?? "Shape"} ${id}`);
  // A cloned shape must not reuse the template's a16:creationId either.
  const ext = firstDescendant(cNvPr, NS.a, "extLst");
  if (ext) cNvPr.removeChild(ext);
}

function describe(shape: XElement): string {
  const cNvPr = firstDescendant(shape, NS.p, "cNvPr");
  return cNvPr ? `${cNvPr.getAttribute("id")}/${cNvPr.getAttribute("name")}` : shape.nodeName;
}
