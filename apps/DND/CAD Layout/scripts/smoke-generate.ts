// Engine smoke test against the real sample files: builds a 2-option JLI deck and a
// 1-option B2C deck from the two Tikni BMPs, writes them to scripts/out/, and converts
// each to PDF. Run with `pnpm engine:smoke` from apps/DND/CAD Layout.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseBmp } from "../lib/engine/bmp";
import { extractPalette } from "../lib/engine/palette";
import { convertPptxToPdf } from "../lib/engine/pdf";
import { generateDeck } from "../lib/engine/pptx/fill";
import { emptySpec, type LayoutSpec } from "../lib/engine/spec";

const root = path.resolve(__dirname, "..");
const samples = path.join(root, "samples");
const templates = path.join(root, "templates");
const out = path.join(root, "scripts", "out");

async function main() {
  await mkdir(out, { recursive: true });
  const taq = await readFile(path.join(samples, "TAQ-622-14-4X19-LAOUT-Deepak-01.bmp"));
  const shm = await readFile(path.join(samples, "SHm-4.bmp"));

  const colours = (bmp: Uint8Array, prefix: string) =>
    extractPalette(parseBmp(bmp))
      .filter((c) => !c.likelyBackground)
      .map((c, i) => ({ hex: c.hex, code: `${prefix}-${String(i + 1).padStart(3, "0")}` }));

  const taqColours = colours(taq, "ARS");
  const shmColours = colours(shm, "GRC");
  console.log(`TAQ palette: ${taqColours.length} colours, top = ${taqColours[0]?.hex}`);
  console.log(`SHm palette: ${shmColours.length} colours, top = ${shmColours[0]?.hex}`);

  // A reference image: re-use the PNG of the SHm design as a stand-in "design intent" photo.
  const { encodePng } = await import("../lib/engine/png");
  const shmParsed = parseBmp(shm);
  const refPng = encodePng(shmParsed.width, shmParsed.height, shmParsed.rgb);

  const spec: LayoutSpec = {
    ...emptySpec(),
    projectNo: "PID-6815",
    construction: "Hand Tufted HD-14 pic",
    clientName: "Sands Solution",
    date: "18/09/26",
    size: "14 ft X 19 ft",
    customerMetrics: "Feet",
    shape: "RCT",
    rugQuality: "Hand Tufted HD",
    fibreContent: "Wool Viscose",
    dyeingTechnique: "Standard",
    finishEdge: "4 side binding",
    pileHeight: "Standard pile",
    pileType: "Cut pile",
    backing: "XN backing",
    wash: "Standard",
    width: "14 ft",
    length: "19 ft",
    area: "266 sq ft",
    notes: "Smoke test — generated from sample files",
  };

  const jli = await generateDeck(
    {
      variant: "jli",
      spec,
      options: [
        { designCode: "TAQ-622-14-4X19-opt-01", bmp: taq, colours: taqColours, references: [{ data: refPng, ext: "png" }] },
        {
          designCode: "SHm-4-opt-02",
          bmp: shm,
          colours: shmColours,
          references: [
            { data: refPng, ext: "png" },
            { data: refPng, ext: "png" },
          ],
        },
      ],
    },
    templates,
  );
  const jliPath = path.join(out, "smoke-jli.pptx");
  await writeFile(jliPath, jli.pptx);
  console.log(`JLI deck -> ${jliPath} (${jli.pptx.length} bytes)`, jli.warnings);

  const b2c = await generateDeck(
    {
      variant: "b2c",
      spec: { ...spec, projectNo: "PD-12926-ND", construction: "Hand Knotted – 11/11", pileHeight: "7-8 MM", size: "5 Feet X 5 Feet", width: "5 Feet", length: "5 Feet" },
      options: [{ designCode: "SHm-4", bmp: shm, colours: shmColours.map((c) => ({ ...c, yarn: "Silk Wool Mix Ply" })), references: [{ data: refPng, ext: "png" }] }],
    },
    templates,
  );
  const b2cPath = path.join(out, "smoke-b2c.pptx");
  await writeFile(b2cPath, b2c.pptx);
  console.log(`B2C deck -> ${b2cPath} (${b2c.pptx.length} bytes)`, b2c.warnings);

  for (const p of [jliPath, b2cPath]) {
    const started = Date.now();
    const result = await convertPptxToPdf(p, out);
    console.log(`PDF for ${path.basename(p)}:`, result, `${Date.now() - started}ms`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
