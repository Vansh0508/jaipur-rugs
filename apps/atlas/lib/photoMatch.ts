import { readdir } from "node:fs/promises";
import path from "node:path";

// Ported 1:1 from Excel to Image/jaipur_image_tool.py's find_best_match (see that
// repo's HANDOVER PROMPT.md, "Matching Logic" section) — Ayaan's existing standalone
// tool for this exact problem (matching a rug photo to a Design + GR Color + BR Color
// row). RugLens reuses the identical algorithm so it shows the same photo that tool
// would have picked for the same row, not a second, subtly different guess.

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"]);

interface FolderCache {
  builtAt: number;
  /** filename (lowercase, with extension) -> full path. Last-scanned wins on a
   * duplicate name across subfolders — same behavior as the Python tool's own
   * all_images dict (jaipur_image_tool.py:606). */
  files: Map<string, string>;
}

// Module-level cache (one per server process) — a live per-request scan of a network
// share with potentially thousands of images would be far too slow to do on every
// RugLens row/page load. 5 minutes balances "not stale for a whole workday" against
// "not rescanning the share on every click."
let cache: FolderCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function scanFolder(rootDir: string, recursive: boolean): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const entries = await readdir(rootDir, { withFileTypes: true, recursive });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;
    // Node marks the containing directory as `.parentPath` (newer Node 20/21) or the
    // older, now-deprecated `.path` — checking both keeps this working across the
    // range of Node 20.x this repo might actually run on (engines.node >=20 only).
    const dir = (entry as unknown as { parentPath?: string; path?: string }).parentPath ?? (entry as unknown as { path?: string }).path ?? rootDir;
    files.set(entry.name.toLowerCase(), path.join(dir, entry.name));
  }
  return files;
}

/** Returns the cached folder listing, rescanning `rootDir` if the cache is stale or
 * doesn't exist yet. Throws if the folder can't be read (share unreachable, wrong
 * network, permissions) — callers decide how to fail (see the photo route's catch). */
export async function getPhotoFolderListing(rootDir: string, recursive: boolean): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.builtAt < CACHE_TTL_MS) return cache.files;
  const files = await scanFolder(rootDir, recursive);
  cache = { builtAt: Date.now(), files };
  return files;
}

/**
 * STRICT matching — returns at most one file path.
 *
 * 1. Design code must match as a complete token in the filename stem (not extension) —
 *    not a substring of a longer code, e.g. "SPR-522" must NOT match "SPR-5222".
 * 2. GR Color and BR Color (if given) must both appear as substrings, case-insensitive.
 * 3. If GR != BR, GR's position in the filename must come before BR's — filenames
 *    follow "DESIGN GR_COLOR [code] BR_COLOR [code].jpg", so without this a GR of
 *    "White" could wrongly match inside a BR of "Cloud White".
 * 4. Only the first qualifying file is returned (iteration order = scan order, same as
 *    the source tool's dict order) — never multiple candidates for one row.
 */
export function findBestMatch(files: Map<string, string>, designCode: string, grColor?: string | null, brColor?: string | null): string | null {
  const d = designCode.toLowerCase().trim();
  const gr = (grColor ?? "").toLowerCase().trim();
  const br = (brColor ?? "").toLowerCase().trim();

  // Strip parenthetical suffixes before matching, e.g. "AKWS-9003(EM)" -> "akws-9003",
  // so it still matches an "AKWS-9003_Red_..." filename.
  const dClean = d.replace(/\s*\([^)]*\)/g, "").trim();
  if (!dClean) return null;

  const escaped = dClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const designPattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`);

  for (const [filename, fullPath] of files) {
    const stem = filename.slice(0, filename.length - path.extname(filename).length);
    if (!designPattern.test(stem)) continue;
    if (gr && !stem.includes(gr)) continue;
    if (br && !stem.includes(br)) continue;

    if (gr && br && gr !== br) {
      const grPos = stem.indexOf(gr);
      const brPos = stem.indexOf(br);
      if (grPos > brPos) continue;
    }

    return fullPath;
  }
  return null;
}
