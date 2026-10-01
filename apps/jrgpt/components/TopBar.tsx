"use client";

import { useEffect, useState } from "react";

/** Full-width bar so the app reads as an app shell, not a centred document. */
export function TopBar({ onMenu }: { onMenu: () => void }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem("jrgpt-theme", next ? "dark" : "light");
    } catch {
      /* private mode - the class still applies for this session */
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-default-200 bg-default-50/80 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className="rounded-lg border border-default-200 px-2.5 py-1 text-small lg:hidden"
      >
        ☰
      </button>

      <span className="text-small font-semibold tracking-tight lg:hidden">JRGPT</span>

      <div className="hidden items-center gap-2 lg:flex">
        <span className="rounded-full border border-default-200 px-2.5 py-1 font-mono text-[11px] text-default-500">
          nav mirror · read-only
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle theme"
          className="rounded-lg border border-default-200 px-2.5 py-1 text-small text-default-500 transition hover:text-foreground"
        >
          {dark ? "☾" : "☀"}
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-tiny font-semibold text-background">
          CP
        </span>
      </div>
    </header>
  );
}
