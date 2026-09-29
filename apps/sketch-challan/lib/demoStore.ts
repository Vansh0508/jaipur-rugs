import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SketchChallan } from "./domain/types";

// Local demo persistence so manager, admin and sketcher logins share one copy of the challans.
// ponytail: one JSON file + in-process lock; fine for one local dev server, replace with Supabase RPC writes before deployment.
const FILE = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "demo-state.json"); // runtime data, never part of a build
let queue: Promise<unknown> = Promise.resolve();

export async function loadRows(): Promise<SketchChallan[]> {
  try {
    return JSON.parse(await readFile(/*turbopackIgnore: true*/ FILE, "utf8")) as SketchChallan[];
  } catch (error) {
    // A fresh server starts empty; the first Refresh Excel fills it.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

// Serialises read-modify-write so two quick clicks can't overwrite each other.
export function updateRows<T>(change: (rows: SketchChallan[]) => { rows: SketchChallan[]; result: T }): Promise<T> {
  const run = queue.then(async () => {
    const { rows, result } = change(await loadRows());
    await mkdir(/*turbopackIgnore: true*/ path.dirname(FILE), { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ `${FILE}.tmp`, JSON.stringify(rows, null, 2));
    await rename(/*turbopackIgnore: true*/ `${FILE}.tmp`, FILE);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
