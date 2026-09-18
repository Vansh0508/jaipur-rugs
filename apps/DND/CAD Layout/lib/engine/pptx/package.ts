// Package-level operations on a .pptx (a zip of OOXML parts): slide order, cloning and
// removing slides, adding media + relationships. Slide *content* edits live in xml.ts.

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { NS, childElements, parseXml, serializeXml, type XDocument, type XElement } from "./xml";

const CT_SLIDE = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const REL_SLIDE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const REL_NOTES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide";

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

export class PptxPackage {
  private docs = new Map<string, XDocument>();
  private mediaByHash = new Map<string, string>();

  private constructor(private zip: JSZip) {}

  static async load(data: Uint8Array): Promise<PptxPackage> {
    return new PptxPackage(await JSZip.loadAsync(data));
  }

  async xml(path: string): Promise<XDocument> {
    const cached = this.docs.get(path);
    if (cached) return cached;
    const file = this.zip.file(path);
    if (!file) throw new Error(`part not found in package: ${path}`);
    const doc = parseXml(await file.async("string"));
    this.docs.set(path, doc);
    return doc;
  }

  /** Slide part paths in presentation order. */
  async slidePaths(): Promise<string[]> {
    const pres = await this.xml("ppt/presentation.xml");
    const rels = await this.xml("ppt/_rels/presentation.xml.rels");
    const byId = new Map<string, string>();
    const relList = rels.getElementsByTagNameNS(NS.rel, "Relationship");
    for (let i = 0; i < relList.length; i++) {
      const rel = relList[i] as XElement;
      byId.set(rel.getAttribute("Id")!, rel.getAttribute("Target")!);
    }
    const ids = pres.getElementsByTagNameNS(NS.p, "sldId");
    const out: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const rId = (ids[i] as XElement).getAttributeNS(NS.r, "id")!;
      out.push(resolve("ppt/presentation.xml", byId.get(rId)!));
    }
    return out;
  }

  /**
   * Duplicates a slide immediately after itself in the slide order. The clone shares the
   * source's media (same image parts) and drops its notes-slide relationship — notes
   * aren't part of the layout, and cloning them would mean a second part tree for nothing.
   */
  async cloneSlide(srcPath: string): Promise<string> {
    const n = this.nextPartNumber("ppt/slides/slide", ".xml");
    const newPath = `ppt/slides/slide${n}.xml`;
    const src = await this.xml(srcPath);
    this.docs.set(newPath, parseXml(serializeXml(src)));

    const srcRelsPath = relsPathFor(srcPath);
    const newRelsPath = relsPathFor(newPath);
    const srcRels = await this.xml(srcRelsPath);
    const newRels = parseXml(serializeXml(srcRels));
    const rels = newRels.getElementsByTagNameNS(NS.rel, "Relationship");
    for (let i = rels.length - 1; i >= 0; i--) {
      const rel = rels[i] as XElement;
      if (rel.getAttribute("Type") === REL_NOTES) rel.parentNode!.removeChild(rel);
    }
    this.docs.set(newRelsPath, newRels);

    // [Content_Types].xml override
    const ct = await this.xml("[Content_Types].xml");
    const override = ct.createElementNS(NS.ct, "Override");
    override.setAttribute("PartName", `/${newPath}`);
    override.setAttribute("ContentType", CT_SLIDE);
    ct.documentElement!.appendChild(override);

    // presentation.xml.rels + sldIdLst (insert right after the source slide)
    const presRels = await this.xml("ppt/_rels/presentation.xml.rels");
    const rId = this.addRelationship(presRels, REL_SLIDE, `slides/slide${n}.xml`);
    const pres = await this.xml("ppt/presentation.xml");
    const sldIdLst = pres.getElementsByTagNameNS(NS.p, "sldIdLst")[0] as XElement;
    const srcRId = this.findRelId(presRels, `slides/${srcPath.split("/").pop()}`);
    const sldIds = childElements(sldIdLst, NS.p, "sldId");
    const maxId = Math.max(...sldIds.map((s) => Number(s.getAttribute("id"))), 255);
    const newSld = pres.createElementNS(NS.p, "p:sldId");
    newSld.setAttribute("id", String(maxId + 1));
    newSld.setAttributeNS(NS.r, "r:id", rId);
    const srcSld = sldIds.find((s) => s.getAttributeNS(NS.r, "id") === srcRId);
    if (srcSld?.nextSibling) sldIdLst.insertBefore(newSld, srcSld.nextSibling);
    else sldIdLst.appendChild(newSld);

    return newPath;
  }

  async removeSlide(path: string): Promise<void> {
    const presRels = await this.xml("ppt/_rels/presentation.xml.rels");
    const target = `slides/${path.split("/").pop()}`;
    const rId = this.findRelId(presRels, target);
    if (rId) {
      const pres = await this.xml("ppt/presentation.xml");
      const sldIds = pres.getElementsByTagNameNS(NS.p, "sldId");
      for (let i = sldIds.length - 1; i >= 0; i--) {
        const s = sldIds[i] as XElement;
        if (s.getAttributeNS(NS.r, "id") === rId) s.parentNode!.removeChild(s);
      }
      const rels = presRels.getElementsByTagNameNS(NS.rel, "Relationship");
      for (let i = rels.length - 1; i >= 0; i--) {
        const rel = rels[i] as XElement;
        if (rel.getAttribute("Id") === rId) rel.parentNode!.removeChild(rel);
      }
    }
    const ct = await this.xml("[Content_Types].xml");
    const overrides = ct.getElementsByTagNameNS(NS.ct, "Override");
    for (let i = overrides.length - 1; i >= 0; i--) {
      const o = overrides[i] as XElement;
      if (o.getAttribute("PartName") === `/${path}`) o.parentNode!.removeChild(o);
    }
    this.docs.delete(path);
    this.docs.delete(relsPathFor(path));
    this.zip.remove(path);
    this.zip.remove(relsPathFor(path));
  }

  /**
   * Adds an image part and relates it to `slidePath`; returns the new `rId`. Identical
   * bytes added twice (the same reference photo on several option slides) share one part.
   */
  async addImage(slidePath: string, data: Uint8Array, ext: string): Promise<string> {
    const cleanExt = ext.toLowerCase().replace(/^\./, "");
    const contentType = IMAGE_CONTENT_TYPES[cleanExt];
    if (!contentType) throw new Error(`unsupported image type .${cleanExt}`);
    const hash = createHash("sha1").update(data).digest("hex");
    let mediaPath = this.mediaByHash.get(hash);
    if (!mediaPath) {
      const n = this.nextPartNumber("ppt/media/image", "");
      mediaPath = `ppt/media/image${n}.${cleanExt}`;
      this.zip.file(mediaPath, data);
      this.mediaByHash.set(hash, mediaPath);
    }
    const mediaName = mediaPath.split("/").pop()!;

    const ct = await this.xml("[Content_Types].xml");
    const defaults = ct.getElementsByTagNameNS(NS.ct, "Default");
    let hasDefault = false;
    for (let i = 0; i < defaults.length; i++) {
      if ((defaults[i] as XElement).getAttribute("Extension")?.toLowerCase() === cleanExt) hasDefault = true;
    }
    if (!hasDefault) {
      const def = ct.createElementNS(NS.ct, "Default");
      def.setAttribute("Extension", cleanExt);
      def.setAttribute("ContentType", contentType);
      ct.documentElement!.insertBefore(def, ct.documentElement!.firstChild);
    }

    const rels = await this.xml(relsPathFor(slidePath));
    const existing = this.findRelId(rels, `../media/${mediaName}`);
    return existing ?? this.addRelationship(rels, REL_IMAGE, `../media/${mediaName}`);
  }

  async save(): Promise<Buffer> {
    for (const [path, doc] of this.docs) {
      this.zip.file(path, serializeXml(doc));
    }
    await this.pruneOrphanMedia();
    return this.zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  /**
   * Media the template carried for slides/pictures we removed or replaced would otherwise
   * ship inside every generated deck (the JLI sample alone holds ~7 MB of old renders).
   */
  private async pruneOrphanMedia(): Promise<void> {
    const referenced = new Set<string>();
    const relsFiles: string[] = [];
    this.zip.forEach((relPath) => {
      if (relPath.endsWith(".rels")) relsFiles.push(relPath);
    });
    for (const relsPath of relsFiles) {
      const xml = await this.zip.file(relsPath)!.async("string");
      const doc = parseXml(xml);
      const list = doc.getElementsByTagNameNS(NS.rel, "Relationship");
      const owner = relsPath.replace("/_rels/", "/").replace(/\.rels$/, "");
      for (let i = 0; i < list.length; i++) {
        const rel = list[i] as XElement;
        if (rel.getAttribute("TargetMode") === "External") continue;
        referenced.add(resolve(owner, rel.getAttribute("Target")!));
      }
    }
    const orphans: string[] = [];
    this.zip.forEach((relPath) => {
      if (relPath.startsWith("ppt/media/") && !relPath.endsWith("/") && !referenced.has(relPath)) orphans.push(relPath);
    });
    for (const o of orphans) this.zip.remove(o);
  }

  private addRelationship(rels: XDocument, type: string, target: string): string {
    const list = rels.getElementsByTagNameNS(NS.rel, "Relationship");
    let max = 0;
    for (let i = 0; i < list.length; i++) {
      const m = /^rId(\d+)$/.exec((list[i] as XElement).getAttribute("Id") ?? "");
      if (m) max = Math.max(max, Number(m[1]));
    }
    const rId = `rId${max + 1}`;
    const rel = rels.createElementNS(NS.rel, "Relationship");
    rel.setAttribute("Id", rId);
    rel.setAttribute("Type", type);
    rel.setAttribute("Target", target);
    rels.documentElement!.appendChild(rel);
    return rId;
  }

  private findRelId(rels: XDocument, target: string): string | undefined {
    const list = rels.getElementsByTagNameNS(NS.rel, "Relationship");
    for (let i = 0; i < list.length; i++) {
      const rel = list[i] as XElement;
      if (rel.getAttribute("Target") === target) return rel.getAttribute("Id") ?? undefined;
    }
    return undefined;
  }

  /** Next free N for `<prefix>N<suffix>` across both zip entries and unsaved docs. */
  private nextPartNumber(prefix: string, suffix: string): number {
    let max = 0;
    const consider = (name: string) => {
      if (!name.startsWith(prefix)) return;
      const rest = name.slice(prefix.length);
      const m = /^(\d+)/.exec(rest);
      if (m && (suffix === "" || rest.endsWith(suffix))) max = Math.max(max, Number(m[1]));
    };
    this.zip.forEach((relPath) => consider(relPath));
    for (const path of this.docs.keys()) consider(path);
    return max + 1;
  }
}

function relsPathFor(partPath: string): string {
  const idx = partPath.lastIndexOf("/");
  return `${partPath.slice(0, idx)}/_rels/${partPath.slice(idx + 1)}.rels`;
}

function resolve(fromPart: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const base = fromPart.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") base.pop();
    else if (seg !== ".") base.push(seg);
  }
  return base.join("/");
}
