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

// Fallback root, tried only when Head Shot has no match — direct feedback, 2026-09-11:
// not every design has a proper headshot on file, but something matching might exist
// in one of the share's other category folders (Room Scene, Custom Photo Folder,
// Floor shot, ...). Defaults to PHOTO_FOLDER's own parent directory — the broader
// "Photo Folder" share root Head Shot itself lives under — so this works out of the box
// without a second env var in the common case; override RUG_LENS_PHOTO_FALLBACK_FOLDER
// only if the fallback root should be something other than Head Shot's parent. Always
// scanned recursively (it has to search across whatever category folders exist, unlike
// the primary folder where recursion is merely optional) and only on a primary miss,
// since it's necessarily a much bigger, slower scan than Head Shot alone.
const FALLBACK_PHOTO_FOLDER = process.env.RUG_LENS_PHOTO_FALLBACK_FOLDER || path.dirname(PHOTO_FOLDER);

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
    let match = findBestMatch(files, design, gr, br);

    if (!match && FALLBACK_PHOTO_FOLDER && FALLBACK_PHOTO_FOLDER !== PHOTO_FOLDER) {
      try {
        const fallbackFiles = await getPhotoFolderListing(FALLBACK_PHOTO_FOLDER, true);
        match = findBestMatch(fallbackFiles, design, gr, br);
      } catch {
        // Fallback root unreachable/unreadable this time — fine, just means no
        // fallback available; the primary lookup above already ran its own course.
      }
    }

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
