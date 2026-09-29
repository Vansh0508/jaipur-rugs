import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MapsState } from "./types";

// Same local demo persistence as lib/demoStore.ts, separate file so a maps refresh never touches challans.
// ponytail: one JSON file + in-process lock; replace with Supabase RPC writes along with the challans.
const FILE = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "maps-state.json"); // runtime data, never part of a build
let queue: Promise<unknown> = Promise.resolve();

export async function loadMaps(): Promise<MapsState> {
  try {
    return JSON.parse(await readFile(/*turbopackIgnore: true*/ FILE, "utf8")) as MapsState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { orders: [] };
    throw error;
  }
}

export function updateMaps<T>(change: (state: MapsState) => { state: MapsState; result: T }): Promise<T> {
  const run = queue.then(async () => {
    const { state, result } = change(await loadMaps());
    await mkdir(/*turbopackIgnore: true*/ path.dirname(FILE), { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ `${FILE}.tmp`, JSON.stringify(state));
    await rename(/*turbopackIgnore: true*/ `${FILE}.tmp`, FILE);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
