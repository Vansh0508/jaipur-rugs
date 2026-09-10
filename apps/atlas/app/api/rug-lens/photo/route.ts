import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireRugLensAccess } from "@/lib/auth/requireRugLensAccess";
import { getPhotoFolderListing, findBestMatch } from "@/lib/photoMatch";

export const runtime = "nodejs"; // needs real filesystem access — must not run on the Edge runtime

// Live read-through from the J-Vault photo share — a deliberate architecture choice
// confirmed with Ayaan, 2026-09-10 (over syncing every photo into Supabase Storage):
// cheap and simple, at the cost of only working when THIS route is actually reachable
// to the share — i.e. requested against the internal office deployment
// (http://192.168.0.18:3001), not the public atlas.jaipurrugsai.cloud VPS, which has no
// network route to any internal share at all (same structural limit as
// scripts/orders-sync.mjs's direct MSSQL connection — see that script's own header
// comment). On the public deployment this route fails closed (404) for every request —
// expected, not a bug to "fix" without first revisiting that decision.
//
// Server-only env, read directly (not through lib/env.ts, which is only for
// NEXT_PUBLIC_* values a browser bundle needs — see that file's header comment).
const PHOTO_FOLDER = process.env.RUG_LENS_PHOTO_FOLDER || String.raw`\\Jvault\Photo Folder\Head Shot`;
const RECURSIVE = process.env.RUG_LENS_PHOTO_FOLDER_RECURSIVE !== "false"; // matches jaipur_image_tool.py's own default (recursive=True)

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
};

export async function GET(request: Request) {
  // Defensive re-check (AGENTS.md Section 5) — proxy.ts's own gate is deliberately
  // coarse ("any reason to be in Atlas at all"), so it alone would let e.g. a Shipping
  // department employee fetch RugLens photos directly even without RugLens access.
  const supabase = await getServerSupabaseClient();
  const access = await requireRugLensAccess(supabase);
  if (!access.hasRugLensAccess) {
    return new Response(null, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const design = searchParams.get("design");
  const gr = searchParams.get("gr");
  const br = searchParams.get("br");
  if (!design) return new Response("Missing design", { status: 400 });

  try {
    const files = await getPhotoFolderListing(PHOTO_FOLDER, RECURSIVE);
    const match = findBestMatch(files, design, gr, br);
    if (!match) return new Response(null, { status: 404 });

    const info = await stat(match);
    if (!info.isFile()) return new Response(null, { status: 404 });

    const bytes = await readFile(match);
    const ext = path.extname(match).toLowerCase();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        // Short client cache — a source photo can be replaced/renamed; this keeps a
        // stale browser cache from outliving that for too long.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    // Folder unreachable (not on the office network, share down, permissions) — fail
    // closed with a plain 404 rather than a 500. This is an expected, deployment-
    // dependent condition (see header comment), not a server error to surface.
    return new Response(null, { status: 404 });
  }
}
