import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getCadLayoutEmployee } from "@/lib/auth/requireCadLayoutAccess";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { JOB_FILES, jobDir, readJobMeta } from "@/lib/jobs";

export const runtime = "nodejs";

// Query-string route (`/api/download?job=<uuid>&kind=pptx|pdf`) rather than
// `[jobId]/[kind]` segments: Turbopack never registered the bracketed folders under this
// app's path (which contains a space) — requests fell through to the 404 page.

const KINDS = {
  pptx: { file: JOB_FILES.pptx, type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  pdf: { file: JOB_FILES.pdf, type: "application/pdf" },
} as const;

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job") ?? "";
  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  const spec = KINDS[kind as keyof typeof KINDS];
  const dir = jobDir(jobId);
  if (!spec || !dir) return NextResponse.json({ error: "not found" }, { status: 404 });

  const supabase = await getServerSupabaseClient();
  const employee = await getCadLayoutEmployee(supabase);
  if (!employee || employee === "unauthorized") {
    return NextResponse.json({ error: "not authorized" }, { status: employee === null ? 401 : 403 });
  }

  const meta = await readJobMeta(jobId);
  if (!meta) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Creator sees their own output; admins see everyone's (PRD Section 8.5).
  if (meta.employeeId !== employee.employeeId && !employee.isAdmin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const data = await readFile(path.join(dir, spec.file));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": spec.type,
        "Content-Disposition": `attachment; filename="${meta.downloadName}.${kind}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
