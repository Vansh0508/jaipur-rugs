"use client";

import { useEffect, useRef, useState } from "react";

export function useLocalPreference<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Storage unavailable or invalid JSON
    } finally {
      hydrated.current = true;
    }
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable
    }
  }, [key, value]);

  return [value, setValue];
}
