// Generated decks live in a per-job folder on the server until downloaded (and until the
// storage layer in PRD Section 8.3 lands — the job folder is the interim record).

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { LayoutVariant } from "./engine/spec";

export interface JobMeta {
  id: string;
  employeeId: string;
  variant: LayoutVariant;
  /** Friendly base name for downloads, e.g. "PID-6815-jli". */
  downloadName: string;
  createdAt: string;
  warnings: string[];
  pdf: { ok: true; converter: string } | { ok: false; error: string };
}

export const JOB_FILES = { pptx: "layout.pptx", pdf: "layout.pdf", meta: "meta.json" } as const;

export function jobsRoot(): string {
  return process.env.CAD_LAYOUT_JOB_DIR || path.join(os.tmpdir(), "cad-layout");
}

export async function createJobDir(): Promise<{ id: string; dir: string }> {
  const id = randomUUID();
  const dir = path.join(jobsRoot(), id);
  await mkdir(dir, { recursive: true });
  return { id, dir };
}

export function jobDir(id: string): string | null {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return path.join(jobsRoot(), id);
}

export async function writeJobMeta(dir: string, meta: JobMeta): Promise<void> {
  await writeFile(path.join(dir, JOB_FILES.meta), JSON.stringify(meta, null, 2), "utf8");
}

export async function readJobMeta(id: string): Promise<JobMeta | null> {
  const dir = jobDir(id);
  if (!dir) return null;
  try {
    return JSON.parse(await readFile(path.join(dir, JOB_FILES.meta), "utf8")) as JobMeta;
  } catch {
    return null;
  }
}

/** Drops job folders older than CAD_LAYOUT_JOB_TTL_HOURS (default 24). Best-effort. */
export async function sweepOldJobs(): Promise<void> {
  const ttlHours = Number(process.env.CAD_LAYOUT_JOB_TTL_HOURS) || 24;
  const cutoff = Date.now() - ttlHours * 3_600_000;
  let entries: string[];
  try {
    entries = await readdir(jobsRoot());
  } catch {
    return;
  }
  await Promise.all(
    entries.map(async (name) => {
      const full = path.join(jobsRoot(), name);
      try {
        const info = await stat(full);
        if (info.isDirectory() && info.mtimeMs < cutoff) await rm(full, { recursive: true, force: true });
      } catch {
        // another request may have removed it already
      }
    }),
  );
}
