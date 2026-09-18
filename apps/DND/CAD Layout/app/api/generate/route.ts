import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCadLayoutEmployee } from "@/lib/auth/requireCadLayoutAccess";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { convertPptxToPdf } from "@/lib/engine/pdf";
import { generateDeck, type DesignOptionFiles } from "@/lib/engine/pptx/fill";
import { LAYOUT_VARIANTS } from "@/lib/engine/spec";
import { createJobDir, JOB_FILES, sweepOldJobs, writeJobMeta } from "@/lib/jobs";
import type { GeneratePayload, GenerateResponse } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_OPTIONS = 12;
const MAX_REFS_PER_OPTION = 6;

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const employee = await getCadLayoutEmployee(supabase);
  if (!employee || employee === "unauthorized") {
    return NextResponse.json({ error: "not authorized" }, { status: employee === null ? 401 : 403 });
  }

  const form = await request.formData();
  const rawPayload = form.get("payload");
  if (typeof rawPayload !== "string") {
    return NextResponse.json({ error: "payload is required" }, { status: 400 });
  }
  let payload: GeneratePayload;
  try {
    payload = JSON.parse(rawPayload) as GeneratePayload;
  } catch {
    return NextResponse.json({ error: "payload is not valid JSON" }, { status: 400 });
  }
  if (!LAYOUT_VARIANTS.includes(payload.variant)) {
    return NextResponse.json({ error: "variant must be one of b2c, jli, b2b" }, { status: 400 });
  }
  if (!Array.isArray(payload.options) || payload.options.length === 0 || payload.options.length > MAX_OPTIONS) {
    return NextResponse.json({ error: `between 1 and ${MAX_OPTIONS} design options are required` }, { status: 400 });
  }

  const options: DesignOptionFiles[] = [];
  for (let i = 0; i < payload.options.length; i++) {
    const opt = payload.options[i]!;
    const bmp = form.get(`bmp_${i}`);
    if (!(bmp instanceof File)) {
      return NextResponse.json({ error: `design option ${i + 1} has no Tikni BMP` }, { status: 400 });
    }
    const references: DesignOptionFiles["references"] = [];
    for (let j = 0; j < MAX_REFS_PER_OPTION; j++) {
      const ref = form.get(`ref_${i}_${j}`);
      if (!(ref instanceof File)) break;
      references.push({ data: new Uint8Array(await ref.arrayBuffer()), ext: path.extname(ref.name).slice(1) || "png" });
    }
    options.push({
      designCode: String(opt.designCode ?? ""),
      colours: (opt.colours ?? []).map((c) => ({
        hex: String(c.hex).replace(/^#/, "").toUpperCase(),
        code: String(c.code ?? ""),
        yarn: c.yarn ? String(c.yarn) : undefined,
      })),
      bmp: new Uint8Array(await bmp.arrayBuffer()),
      references,
    });
  }
  for (const opt of options) {
    if (opt.colours.some((c) => !/^[0-9A-F]{6}$/.test(c.hex))) {
      return NextResponse.json({ error: "every colour needs a 6-digit hex value" }, { status: 400 });
    }
  }

  void sweepOldJobs();
  const { id, dir } = await createJobDir();

  try {
    const templatesDir = path.join(process.cwd(), "templates");
    const deck = await generateDeck({ variant: payload.variant, spec: payload.spec, options }, templatesDir);
    const pptxPath = path.join(dir, JOB_FILES.pptx);
    await writeFile(pptxPath, deck.pptx);

    const pdf = await convertPptxToPdf(pptxPath, dir);
    const downloadName = `${(payload.spec.projectNo || "layout").replace(/[^\w.-]+/g, "_")}-${payload.variant}`;
    await writeJobMeta(dir, {
      id,
      employeeId: employee.employeeId,
      variant: payload.variant,
      downloadName,
      createdAt: new Date().toISOString(),
      warnings: deck.warnings,
      pdf: pdf.ok ? { ok: true, converter: pdf.converter } : { ok: false, error: pdf.error },
    });

    const body: GenerateResponse = {
      jobId: id,
      pptxUrl: `/api/download?job=${id}&kind=pptx`,
      pdfUrl: pdf.ok ? `/api/download?job=${id}&kind=pdf` : null,
      pdfError: pdf.ok ? null : pdf.error,
      warnings: deck.warnings,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
}
