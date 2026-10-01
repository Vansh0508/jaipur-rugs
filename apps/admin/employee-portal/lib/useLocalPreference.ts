"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Per-device UI preferences that shouldn't need a server round-trip or a real DB column
 * (sidebar expanded/collapsed) — copied from apps/admin/internal-portal (itself adapted from
 * apps/hub's), kept app-local rather than shared (AGENTS.md Section 4 — this is
 * app-scoped UI state, not a capability other apps invoke). Keyed
 * `employee-portal:<feature>` (see call sites).
 *
 * Starts from `initialValue` on both the server render and the client's first render
 * (so SSR output matches the client's first paint — reading localStorage during render
 * would desync the two, since the server has no localStorage at all), then syncs from
 * whatever's actually stored right after mount. Every read/write is wrapped in try/catch
 * and silently falls back to `initialValue`/a no-op — private browsing, a disabled
 * storage API, or a quota error should never break the page, just leave the preference
 * unpersisted for that session.
 *
 * One deliberate difference from Hub/Atlas's copy: storage is written from the setter,
 * not from a `[value]` effect. That effect runs in the same commit as the read effect,
 * while `value` is still `initialValue` — so it writes the default over what's stored,
 * and under React StrictMode (`next dev`) the simulated remount then re-reads that
 * default back, so a collapsed sidebar reloaded as expanded every time in dev. Writing
 * only on an explicit set means a mount can never touch storage at all. */
export function useLocalPreference<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initialValue);
  // Mirrors `value` so the setter can resolve a functional update synchronously (and
  // write that exact result to storage) without doing side effects inside a state
  // updater. Only ever changed alongside setValue below, so it never drifts.
  const valueRef = useRef(value);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const stored = JSON.parse(raw) as T;
        valueRef.current = stored;
        setValue(stored);
      }
    } catch {
      // Storage unavailable, or the stored value isn't valid JSON — keep initialValue.
    }
  }, [key]);

  const setPreference = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      setValue(resolved);
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage unavailable (private browsing, quota, ...) — preference just won't persist.
      }
    },
    [key],
  );

  return [value, setPreference];
}
