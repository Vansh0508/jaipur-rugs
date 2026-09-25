"use client";

import { useEffect, useRef, useState } from "react";

/** Per-device UI preferences that shouldn't need a server round-trip or a real DB column
 * (sidebar expanded/collapsed) — same hook as apps/atlas/lib/useLocalPreference.ts, kept
 * app-local rather than shared (AGENTS.md Section 4 — this is app-scoped UI state, not a
 * capability other apps invoke). Keyed `hub:<feature>` (see call sites).
 *
 * Starts from `initialValue` on both the server render and the client's first render
 * (so SSR output matches the client's first paint — reading localStorage during render
 * would desync the two, since the server has no localStorage at all), then syncs from
 * whatever's actually stored right after mount. Every read/write is wrapped in try/catch
 * and silently falls back to `initialValue`/a no-op — private browsing, a disabled
 * storage API, or a quota error should never break the page, just leave the preference
 * unpersisted for that session. */
export function useLocalPreference<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initialValue);
  // Guards the write-back effect from firing (and clobbering whatever's actually in
  // storage with `initialValue`) before the read effect below has had a chance to run.
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Storage unavailable, or the stored value isn't valid JSON — keep initialValue.
    } finally {
      hydrated.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately re-reads only when `key` itself changes
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable (private browsing, quota, ...) — preference just won't persist.
    }
  }, [key, value]);

  return [value, setValue];
}
