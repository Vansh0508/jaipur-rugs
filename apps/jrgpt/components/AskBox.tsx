"use client";

import { useEffect, useRef, useState } from "react";

export type AskState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "unavailable"; detail: string }
  | { status: "error"; detail: string };

/**
 * The single input. Sits inside `.jr-field`, which paints the soft ochre glow behind it.
 * Cmd/Ctrl+Enter submits; the button is the same action for touch.
 */
export function AskBox({
  value,
  onChange,
  onSubmit,
  state,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  state: AskState;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [rows, setRows] = useState(1);

  useEffect(() => {
    const lines = Math.min(5, Math.max(1, value.split("\n").length));
    setRows(lines);
  }, [value]);

  const busy = state.status === "asking";

  return (
    <div className="jr-field w-full">
      <div className="rounded-2xl border border-default-200 bg-background/90 p-2.5 shadow-sm backdrop-blur transition focus-within:border-default-400">
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask about sales, production, stock, customers…"
          aria-label="Ask a question"
          className="w-full resize-none bg-transparent px-2.5 py-2 text-medium leading-relaxed outline-none placeholder:text-default-400"
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <span className="font-mono text-[10.5px] text-default-400">jrgpt · read-only</span>
          <div className="flex items-center gap-2">
            <kbd className="hidden rounded-md border border-default-200 px-1.5 py-0.5 text-[10.5px] text-default-400 sm:inline">
              ⌘↵
            </kbd>
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy || !value.trim()}
              aria-label="Send question"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background transition disabled:opacity-35"
            >
              {busy ? "…" : "↑"}
            </button>
          </div>
        </div>
      </div>

      {state.status === "unavailable" || state.status === "error" ? (
        <div
          role="status"
          className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-small leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {state.detail}
        </div>
      ) : null}
    </div>
  );
}
