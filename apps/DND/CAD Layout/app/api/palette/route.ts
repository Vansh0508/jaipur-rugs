import { NextResponse } from "next/server";
import { parseBmp } from "@/lib/engine/bmp";
import { analyseTikni } from "@/lib/engine/palette";
import { downscaleRgb, encodePng } from "@/lib/engine/png";
import type { PaletteResponse } from "@/lib/api";

export const runtime = "nodejs";

const MAX_BMP_BYTES = 60 * 1024 * 1024;

/** Reads one Tikni BMP and returns its palette (area-ordered), legend order and a preview. */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_BMP_BYTES) {
    return NextResponse.json({ error: "BMP is larger than 60 MB" }, { status: 413 });
  }

  try {
    const bmp = parseBmp(new Uint8Array(await file.arrayBuffer()));
    const analysis = analyseTikni(bmp);
    const preview = downscaleRgb(bmp.rgb.subarray(0, analysis.designHeight * bmp.width * 3), bmp.width, analysis.designHeight, 480);
    const body: PaletteResponse = {
      width: bmp.width,
      height: bmp.height,
      designHeight: analysis.designHeight,
      colours: analysis.byArea,
      legendOrder: analysis.legend?.order ?? null,
      preview: `data:image/png;base64,${encodePng(preview.width, preview.height, preview.rgb).toString("base64")}`,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
}
